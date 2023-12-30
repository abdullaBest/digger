import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OrbitControls } from './lib/OrbitControls.js'
import { Assets } from './assets.js'
import { SceneEdit, SceneElement } from "./scene_edit.js";
import { TransformControls } from './lib/TransformControls.js';
import SceneMath from './scene_math.js';
import { SceneCollisions, BoxCollider } from './scene_collisions.js';
import { lerp } from './math.js';
import { resolve } from 'path';
import { rejects } from 'assert';

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.vec3_0 = new THREE.Vector3();
        this.gltfs = {};
        this.models = {};
        this.tilesets = {};
        this.materials = {};
        this.debug_colliders = {};
        this.guids = 0;
    }
    
    vec2_0: THREE.Vector2;
    vec3_0: THREE.Vector3;

    // used for gltfs cache
    gltfs: { [id: string] : any; };
    // used for 3d objects
    objects: { [id: string] : any; };
    // stores pointers to models data
    // tynroar note: probably bad and unsafe idea
    models: { [id: string] : any; };
    tilesets: { [id: string] : Array<string>; };
    materials: { [id: string] : THREE.Material; };
    debug_colliders: { [id: string] : THREE.Mesh; };
    guids: number;
}

class SceneRender {
    
    private canvas: HTMLCanvasElement;
    private refSizeEl: HTMLElement | null | undefined;

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    transform_controls: TransformControls;
    private mousepos: THREE.Vector2;
    private raycaster: THREE.Raycaster;

    private scene_math: SceneMath;
    assets: Assets;
    scene_edit: SceneEdit;
    private active: Boolean;
    private cache: SceneCache;

    colliders: SceneCollisions;

    _drawDebug2dAabb: boolean;

    constructor(scene_edit: SceneEdit, colliders: SceneCollisions) {
        this.scene_edit = scene_edit;
        this.assets = this.scene_edit.assets;
        this.active = false;
        this.cache = new SceneCache();
        this.mousepos = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.scene_math = new SceneMath();
        this.colliders = colliders;
        this._drawDebug2dAabb = true;
    }
    init(canvas: HTMLCanvasElement) : SceneRender {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
        const renderer = new THREE.WebGLRenderer({ canvas , alpha: true });
        this.refSizeEl = canvas.parentElement;
        this.canvas = canvas;

        const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        const cube = new THREE.Mesh( geometry, material );
        scene.add( cube );

        const light1 = new THREE.AmbientLight(0xffffff, 0.7);
		light1.name = 'ambient_light';
		camera.add(light1);
        const light2 = new THREE.DirectionalLight(0xffffff, 2.3);
		(light2 as any).position.set(0.5, 0, 0.866); // ~60º
		light2.name = 'main_light';
		scene.add(light2);
        
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.2);
        hemiLight.name = 'hemi_light';
        scene.add(hemiLight);

        this.controls = new OrbitControls(camera, renderer.domElement);
		this.controls.screenSpacePanning = true;

        this.transform_controls = new TransformControls( camera, renderer.domElement );
        this.transform_controls.addEventListener( 'objectChange', (e) => {
            const object = e.target.object as THREE.Object3D;
            const id = object.name;
            const el = this.scene_edit.elements && this.scene_edit.elements[id];

            let mproperties = this.cache.models[id];

            // just in case: if scene elements has required element - use pointer from there
            if (el && el.components.model) {
                mproperties = el.components.model.properties;
            }
            if (mproperties) {
                mproperties.matrix = object.matrixWorld.toArray()

                object.traverse((o) => {
                    if (!o.isMesh) {
                        return;
                    }
                    if(mproperties.collider) {
                        this.makeObjectAabb2d(id, o, object);
                    }
                });
            }
        });
        this.transform_controls.addEventListener( 'mouseDown', ( event ) => {
            this.controls.enabled = false;
        } );
        this.transform_controls.addEventListener( 'mouseUp',  ( event ) => {
            this.controls.enabled = true;
        } );
        scene.add(this.transform_controls);

        let localMouse = {x: 0, y: 0}
        canvas.addEventListener('mousedown', (ev: MouseEvent) => {
            localMouse.x = ev.clientX;
            localMouse.y = ev.clientY;
        });
        canvas.addEventListener('mouseup', (ev: MouseEvent) => {
            const deltax = Math.abs(ev.clientX - localMouse.x);
            const deltay = Math.abs(ev.clientY - localMouse.y);
            if (deltax + deltay < 10) {
                this.onMouseClick(ev);
            }
        });
        
        (camera as any).position.z = 2;

        this.cube = cube;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.updateSize();
        //this.test();

       
        return this;
    }

    removeTileset(id: string) {
        const tiles = this.cache.tilesets[id];
        if (!tiles) {
            return;
        }
        console.log("remove tileset " + id)
        while(tiles?.length) {
            this.removeModel(tiles.pop() as any)
        }
        delete this.cache.tilesets[id];
    }

    clearTilesets() {
        for(const id in this.cache.tilesets) {
            this.removeTileset(id);
        }
    }

    async addTileset(id: string, tileset: any) {
        this.removeTileset(id);
        console.log("add tileset " + id, tileset)
        this.cache.tilesets[id] = [];

        const color_id_prefix = tileset.color_id_prefix;
        const link_id_prefix = tileset.link_id_prefix;

        const list = {}

        // generate tileset list
        for (let i = 0; i < tileset.guids; i++) {
            const color_id = color_id_prefix + i;
            const link_id = link_id_prefix + i;
            let color = tileset[color_id];
            const link = tileset[link_id];
            if (!color || !link) {
                continue;
            }

            if (!color.includes("0x")) {
                throw new Error(`SceneRender::addTileset error - wrong color "${color}" format. It should start with "0x"`);
            }
            if (color.length != "0x00000000".length) {
                color += "ff";
            }
            if (color.length != "0x00000000".length) {
                throw new Error(`SceneRender::addTileset error - wrong color "${color}" length. It should be like "0x000000" (RGB) or "0x00000000" (RGBA)`);
            }

            if (!link) {
                throw new Error(`SceneRender::addTileset error - link for color ${color} wasn't defined`);
            }
            const model = await (await fetch(this.assets.get(link).info.url)).json();
            list[parseInt(color)] = model;
        }

        // extract image tileset data
        const loadimg = (url) => {
            const img = document.createElement("img");
            return new Promise((resolve, reject) => {
                img.src = url;
                img.onload = (ev) => resolve(ev.target);
                img.onerror = reject;
            })
        }
        const img = await loadimg(this.assets.get(tileset.texture).info.url) as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const imgdata = ctx?.getImageData(0, 0, img.width,  img.height).data;

        if (!imgdata) {
            throw new Error("SceneRender::addTileset error - no image data");
        }

        // parse image tileset
        const unused_colors: Array<number> = [];
        let guids = 0;
        for(let i = 0; i < imgdata.length && this.cache.tilesets[id]; i += 4) {
            const r = imgdata[i] & 0xFF;
            const g = imgdata[i + 1] & 0xFF;
            const b = imgdata[i + 2] & 0xFF;
            const a = imgdata[i + 3] & 0xFF;
            const color = (r<< 24 >>>0) + (g<<16) + (b<<8) + (a<<0);

            const model = list[color];
            if (!model) {
                if (!unused_colors.find((c) => c != color)) {
                    unused_colors.push(color);
                }
                continue;
            }

            // add meshes
            const pos_x = ((i / 4) % canvas.width) * tileset.tilesize_x;
            const pos_y = -Math.floor((i / 4) / canvas.width) * tileset.tilesize_y;
            const modelid = `${id}-tile-${guids++}`;
            this.removeModel(modelid); // in async cases that possible to have old model listed
            const obj = await this.addModel( modelid, model, {make_collider: false });

            // something deleted tileset durning loading
            if (!this.cache.tilesets[id]) {
                this.removeModel(modelid);
                break;
            }

            this.cache.tilesets[id].push(modelid);
            this.setPos(obj, this.cache.vec3_0.set(pos_x , pos_y, 0));
            if(model.collider) {
                this.produceObjectColliders(modelid, obj);
            }
        }

        for(const i in unused_colors) {
            console.warn(`SceneRender::addTileset ref texture has color 0x${unused_colors[i].toString(16).padStart(8, "0")} which does not have tile for that.`);
        }
    }

    /**
     * "model" works only with "imported" gltf's wich does not have any internal links
     * @param id model asset id
     * @returns gltf data
     */
    async addModel(id: string, model: any, opts = { make_collider: true }) : Promise<any> {
        const gltfurl = this.assets.get(model.gltf).info.url
        const textureurl = this.assets.get(model.texture).info.url

        if (!gltfurl || !textureurl) {
            throw new Error(
                `Load model errors: wrong ids 
                gltf = [${model.gltf}:${gltfurl}], 
                texture = [${model.texture}:${textureurl}]`
                )
        }
        
        const afterload = (scene: THREE.Object3D) => {
            this.cache.models[id] = model;
            this.cache.objects[id] = scene;
            scene.name = id;
            this.scene.add( scene );

            if (model.matrix?.length) {
                (scene as THREE.Object3D).applyMatrix4(new THREE.Matrix4().fromArray(model.matrix))
            }
            const material = this.getMaterial(model.material, textureurl);
            scene.traverse((o) => {
                if (!o.isMesh) {
                    return;
                }

                o.material = material;
            });

            if (opts.make_collider && model.collider) {
                this.produceObjectColliders(id, scene);
            }

            //console.log(dumpObject(scene).join('\n'));
        }

        let gltf = this.cache.gltfs[model.gltf];
        if(gltf) {
            const newscene = gltf.scene.clone(true);
            afterload(newscene);
            return newscene;
        }

        const loading_manager = new THREE.LoadingManager();
        const loader = new GLTFLoader(loading_manager);
        loading_manager.setURLModifier((path: string, s: any, r: any) => {
            if (path.includes(".bin")) {
                console.warn(`SceneRender::addModel: model ${model.gltf} has internal '.bin' dependency. Please reimport`)
                const name = path.split('/').pop();
                return `/assets/load?name=${name}`;
            } else if (path.includes(".png")) {
                console.warn(`SceneRender::addModel: model ${model.gltf} has internal '.png' dependency. Please reimport`)
                return textureurl;
            } else if (path.includes(gltfurl)) {
                return gltfurl;
            }

            return path;
        })


        const load = () => {
            return new Promise((resolve, reject) => {
                loader.load( gltfurl,  ( gltf ) => {
                    this.cache.gltfs[model.gltf] = gltf;
                    const scene = gltf.scene.clone();
                    afterload(scene);
                    resolve(scene);
                }, undefined,  reject );
            })
        }

        return load();
    }

    // tmp. only gonna work for gltf.scenes with one mesh
    produceObjectColliders(id: string, obj: THREE.Object3D) {
        obj.traverse((o) => {
            if (!o.isMesh) {
                return;
            }
            this.makeObjectAabb2d(id, o, obj);
        });
    }

    makeObjectAabb2d(id: string, mesh: THREE.Mesh, transform_node: THREE.Object3D) {
        const box = this.scene_math.intersectAABBPlaneTo2dAabb(mesh.geometry, transform_node, this.colliders.origin, this.colliders.normal);
        if (!box) {
            if(this.cache.debug_colliders[id]) {
                this.scene.remove(this.cache.debug_colliders[id]);
                delete this.cache.debug_colliders[id];
                this.colliders.removeCollider(id);
            }
            return;
        }
        this.colliders.removeCollider(id);
        const collider = this.colliders.addBoxCollider(id, box);
        if (this._drawDebug2dAabb) {
            this.drawColliderDebug(id, collider);
        }
    }

    drawColliderDebug(id: string, collider: BoxCollider) {
        let plane = this.cache.debug_colliders[id];
        if (!plane) {
            const geometry = new THREE.PlaneGeometry( 1, 1 );
            // tynroar tmp todo: move material into cache
            const material = new THREE.MeshStandardMaterial( { color: 0x00ffff, wireframe: true } );
            plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
        }
        this.setPos(plane, new THREE.Vector3(collider.pos_x, collider.pos_y, this.colliders.origin.z))
        const planepos = (plane as any).position;
        (plane as any).scale.set(collider.width, collider.height, 1);
        plane.lookAt(planepos.x + this.colliders.normal.x, planepos.y + this.colliders.normal.y, this.colliders.origin.z + this.colliders.normal.z);
        this.cache.debug_colliders[id] = plane;
    }

    removeModel(id: string) {
        this.transform_controls.detach();
        
        if(this.cache.debug_colliders[id]) {
            this.scene.remove(this.cache.debug_colliders[id]);
            delete this.cache.debug_colliders[id];
        }
        if(this.cache.gltfs[id]) {
            delete this.cache.gltfs[id];
        }
        if(this.cache.objects[id]) {
            this.scene.remove(this.cache.objects[id]);
            delete this.cache.objects[id];
        }
        delete this.cache.models[id];
        this.colliders.remove(id);
    }
    clearModels() {
        this.transform_controls.detach();
        for(const k in this.cache.models) {
            this.removeModel(k)
        }

        // remove gltfs that wasn't included into models list
        for(const k in this.cache.gltfs) {
            delete this.cache.gltfs[k];
        }
        for(const k in this.cache.objects) {
            this.scene.remove(this.cache.objects[k]);
            delete this.cache.objects[k];
        }
        this.cache.models = {};
        this.cache.gltfs = {};
        this.cache.objects = {};
    }
    viewModel(id: string, model: any) {
        this.clearModels();
        this.addModel(id, model);
    }

    addGLTF(url: string, name?: string) : Promise<any> {
        return new Promise((resolve, reject) => {
            const loading_manager = new THREE.LoadingManager();
            const loader = new GLTFLoader(loading_manager);
            loading_manager.setURLModifier((path: string) => {
                // 0. blobbed data. Leave as it is
                if (path.includes('data:application/octet-stream') || path.includes('data:image')) {
                    return path;
                }
                // 1. Loads model itself. Same
                if (path.includes(url)) {
                    return path;
                }

                // 2. Loads model dependencies. Replace it with custom path
                // Works with model names so this could produce errors
                const name = path.split('/').pop();
                return `/assets/load?name=${name}`;
            })

            loader.load( url,  ( gltf ) => {
                this.scene.add( gltf.scene );
                let id = name ??  "g_" + this.cache.guids++
                gltf.scene.name = id;
                this.cache.gltfs[id] = gltf;
                this.cache.objects[id] = gltf.scene;
                console.log(dumpObject(gltf.scene).join('\n'));
                resolve(gltf);
            }, undefined,  ( error ) => {
                console.error( error );
                reject(error);
            } );
        })
    }

    /**
     * Basic way to display model.
     * Resolves internal urls by asset name.
     * @param url gltf file url
     */
    async viewGLTF(url: string) : Promise<THREE.Object3D> {
        this.clearModels();
        return await this.addGLTF(url);
    }

    /**
     * Creates new material or finds it in cache
     * @param name material name
     * @param texture_url path to lexture
     */
    getMaterial(name: string, texture_url: string) : THREE.Material {
        const materialTypes = { standart: THREE.MeshStandardMaterial, toon: THREE.MeshToonMaterial }

        if(!name || !materialTypes[name]) {
            console.warn(`SceneRender::getMaterial meterial preset has no type ${name}. Using 'standart'`);
            name = "standart";
        }
        
        const id = `${name}_${texture_url}`;
        if (this.cache.materials[id]) {
            return this.cache.materials[id];
        }

        const texture = new THREE.TextureLoader().load( texture_url );
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;

        const materialOptions = { 
            standart:  { roughness: 0.7 },
            toon: {}
        }
        const options = Object.assign({color: 0xffffff, name: id, map: texture }, materialOptions[name]);
        const material = new materialTypes[name](options);
        this.cache.materials[id] = material;

        return material;
    }

    dispose() {
        this.stop();
    }
    run() {
        this.active = true;
    }
    stop() {
        this.active = false;
    }
    step() {
        if (!this.active) {
            return;
        }

        this.updateSize();

        this.cube.rotateX(0.01);
        this.cube.rotateY(0.01);
        if(this._drawDebug2dAabb) {
            for(const k in this.colliders.bodies) {
                const body = this.colliders.bodies[k];
                this.drawColliderDebug(k, body.collider);
            }
        }

        if (this.cache.gltfs["player_character"] && this.colliders.bodies["player_character"]) {
            const gltf = this.cache.gltfs["player_character"];
            /*
            let m: THREE.AnimationMixer = gltf.mixer;
            if (!m) {
                m = new THREE.AnimationMixer(gltf.scene);
                gltf.mixer = m;
                let action = m.clipAction(THREE.AnimationClip.findByName(gltf, "Run"));
                action.play();
            }
            m.update(0.01);
            */
            const cha = gltf.scene;
            const body = this.colliders.bodies["player_character"];

            // { tmp. will be moved into object render class
            if (!cha.steplerpinfo) {
                cha.steplerpinfo = {step_number: this.colliders.step_number, prev_x: 0, prev_y: 0, next_x: 0, next_y: 0};
            }
            if (this.colliders.step_number != cha.steplerpinfo.step_number) {
                cha.steplerpinfo.prev_x = cha.steplerpinfo.next_x;
                cha.steplerpinfo.prev_y = cha.steplerpinfo.next_y;
                cha.steplerpinfo.next_x = body.collider.pos_x;
                cha.steplerpinfo.next_y = body.collider.pos_y;
                cha.steplerpinfo.step_number = this.colliders.step_number;
            }
            // tmp }

            const x = lerp(cha.steplerpinfo.prev_x, cha.steplerpinfo.next_x, this.colliders.step_elapsed / this.colliders.step_threshold);
            const y = lerp(cha.steplerpinfo.prev_y - body.collider.height/2, cha.steplerpinfo.next_y - body.collider.height/2, this.colliders.step_elapsed / this.colliders.step_threshold);
            this.setPos(cha, this.cache.vec3_0.set(x, y, 0))
            cha.lookAt(this.cache.vec3_0.set(x + body.velocity_x, y, 0))
        }
    
        this.renderer.render( this.scene, this.camera );
    }

    /**
     * attaches scene canvas to new parent node
     * @param newel new element to attach canvas
     */
    reattach(newel: HTMLElement) {
        if (newel == this.refSizeEl) {
            return;
        }

        this.canvas.parentElement?.removeChild(this.canvas);
        newel.appendChild(this.canvas);
        this.refSizeEl = newel;
        this.updateSize();
    }

    private updateSize() {
        this.renderer.getSize(this.cache.vec2_0);
        const offsetWidth = Math.floor(this.refSizeEl?.offsetWidth || 100);
        const offsetHeight = Math.floor(this.refSizeEl?.offsetHeight || 100);
        if (
            this.cache.vec2_0.width != offsetWidth ||
            this.cache.vec2_0.height != offsetHeight 
            ) {
                this.renderer.setSize(offsetWidth, offsetHeight);
                this.camera.aspect = offsetWidth / offsetHeight;
                this.camera.updateProjectionMatrix();
            }
    }

    onMouseClick( event ) {
        event.preventDefault();
        this.mousepos.x = ( event.layerX / event.target.offsetWidth ) * 2 - 1;
        this.mousepos.y = - ( event.layerY / event.target.offsetHeight ) * 2 + 1;
        this.raycaster.setFromCamera( this.mousepos, this.camera );
        const intersects = this.raycaster.intersectObjects( this.scene.children, true );

        let model: THREE.Object3D | null = null;
        for(const i in intersects) {
            const intersect = intersects[i];
            let o = intersect.object;
            while(o) {
                if (this.cache.models[o.name]) {
                    model = o;
                    break;
                }
                o = o.parent;
            } 
            if (model) {
                break;
            }
        }

        if ( model ) {
            console.log("transform attached to " + model.name)
            this.transform_controls.attach(model);
        }

    }

    /**
     * Avoiding typescript errors
     * @param o 
     * @param pos 
     */
    setPos(o: THREE.Object3D, pos: THREE.Vector3) {
        if((o as any).position) {
            (o as any).position.copy(pos);
        }
    }


    // --- tests

    test() {
        const porigin = new THREE.Vector3(0, 0, 0);
        const pnormal = new THREE.Vector3(0, 0, 1).normalize();
		//const onplane = this.intersectLinePlane(line, origin, normal);

        // test plane
        {
            const geometry = new THREE.PlaneGeometry( 10, 10 );
            const material = new THREE.MeshStandardMaterial( { color: 0xff0000, transparent: true, opacity: 0.2 } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, porigin);
            plane.lookAt(porigin.x + pnormal.x, porigin.y + pnormal.y, porigin.z + pnormal.z);
        }

        // test geometry
        const borigin = new THREE.Vector3(1, 0, 0);
        const bnormal = new THREE.Vector3(1, 0.4, 1).normalize();
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0xaaaaaa } );
        const mesh = new THREE.Mesh( geometry, material );
        this.scene.add( mesh );
        this.setPos(mesh, borigin);
        mesh.lookAt(borigin.x + bnormal.x, borigin.y + bnormal.y, borigin.z + bnormal.z);

       const {length, vertices, intersections} = this.scene_math.intersectAABBPlane(mesh.geometry, mesh, porigin, pnormal);

        // debug draw
        for(let i in vertices) {
            this.testSphereAdd(vertices[i], 0.02, 0xeeeeee);
        }
        /*
        for(let i = 0; i < length; i++) {
            this.testSphereAdd(intersections[i], 0.07, 0xffff00);
        }*/
        const points_2d = this.scene_math.posOnPlaneArray(intersections, porigin, pnormal);
        for(let i = 0; i < length; i++) {
            this.testSphereAdd(new THREE.Vector3(points_2d[i].x, points_2d[i].y, 0), 0.03, 0xffff00);
        }

        // final test goal
        const box = this.scene_math.pointsToAabb2d(points_2d, length);

        // aabb plane
        {
            const geometry = new THREE.PlaneGeometry( box.max.x - box.min.x, box.max.y - box.min.y );
            const material = new THREE.MeshStandardMaterial( { color: 0x00ffff, wireframe: true } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, new THREE.Vector3((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2, 0));
            const planepos = (plane as any).position;
            plane.lookAt(planepos.x + pnormal.x, planepos.y + pnormal.y, planepos.z + pnormal.z);
        }

        //const bbox = new THREE.Box3().setFromObject(box)
        //box.geometry.computeBoundingBox();

    }

    /**
     * Testin line-plane intersections
     */
    test1() {
        const pointa = new THREE.Vector3(0, 0, 0);
        const pointb = new THREE.Vector3(0, 3, 3);
        const line = new THREE.Line3(pointa, pointb);
        const origin = new THREE.Vector3(0, 0, 0);
        const normal = new THREE.Vector3(0, 0, 1).normalize();
		const onplane = this.scene_math.intersectLinePlane(line, origin, normal);

        this.testSphereAdd(pointa, 0.1, 0xffff00);
        this.testSphereAdd(pointb, 0.1, 0xffff00);
        if(onplane) {
            this.testSphereAdd(onplane, 0.2, 0xff0000);
        }

        const geometry = new THREE.PlaneGeometry( 10, 10 );
        const material = new THREE.MeshBasicMaterial( { color: 0xaaaaaa } );
        const plane = new THREE.Mesh( geometry, material );
        this.scene.add( plane );
        this.setPos(plane, origin);
        plane.lookAt(origin.x + normal.x, origin.y + normal.y, origin.z + normal.z);
    }

    test2() {
        if(this._drawDebug2dAabb) {
            const geometry = new THREE.PlaneGeometry( 10, 10 );
            const material = new THREE.MeshStandardMaterial( { color: 0xaaaa00, transparent: true, opacity: 0.1 } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, this.colliders.origin)
            plane.lookAt(this.colliders.origin.x + this.colliders.normal.x, this.colliders.origin.y + this.colliders.normal.y, this.colliders.origin.z + this.colliders.normal.z);
        }

        {
            let groundbox = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(0, -1), new THREE.Vector2(1, 1));
            const groundbody = this.colliders.addBoxCollider("ground", groundbox);
            this.drawColliderDebug("ground", groundbody);
        }
        {
            let groundbox = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(2, -1), new THREE.Vector2(1, 1));
            const groundbody = this.colliders.addBoxCollider("ground2", groundbox);
            this.drawColliderDebug("ground2", groundbody);
        }
        let groundbox1 = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(-1.5, 0.5), new THREE.Vector2(1, 1));
        const groundbody1 = this.colliders.addBoxCollider("ground1", groundbox1);
        this.drawColliderDebug("ground1", groundbody1);
    }

    testSphereAdd(pos: THREE.Vector3, size: number = 0.1, color: number = 0xffffff) {
        const geometry = new THREE.SphereGeometry(size);
        const material = new THREE.MeshBasicMaterial( { color } );
        const sphere = new THREE.Mesh( geometry, material );
        this.setPos(sphere, pos);
        this.scene.add( sphere );
        return sphere
    }

}

function dumpObject(obj, lines: Array<string> = [], isLast = true, prefix = '') {
    const localPrefix = isLast ? '└─' : '├─';
    lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
    const newPrefix = prefix + (isLast ? '  ' : '│ ');
    const lastNdx = obj.children.length - 1;
    obj.children.forEach((child, ndx) => {
      const isLast = ndx === lastNdx;
      dumpObject(child, lines, isLast, newPrefix);
    });
    return lines;
  }

export default SceneRender;
