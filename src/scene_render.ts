import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OrbitControls } from './lib/OrbitControls.js'
import { Assets } from './assets.js'
import { SceneEdit, SceneElement } from "./scene_edit.js";
import { TransformControls } from './lib/TransformControls.js';
import SceneMath from './scene_math.js';
import { SceneCollisions, BoxCollider } from './scene_collisions.js';

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.gltfs = [];
        this.models = {};
        this.materials = {};
        this.debug_colliders = {};
    }
    
    
    vec2_0: THREE.Vector2;

    // used for raw gltfs
    gltfs: Array<any>;
    // used for model scene element gltfs
    models: { [id: string] : any; };
    materials: { [id: string] : THREE.Material; };
    debug_colliders: { [id: string] : THREE.Mesh; };
}

class SceneRender {
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
            const object = e.target.object;
            const id = object.name;
            const el = this.scene_edit.elements && this.scene_edit.elements[id];
            if (el && el.components.model) {
                el.components.model.properties.pos_x = object.position.x;
                el.components.model.properties.pos_y = object.position.y;
                el.components.model.properties.pos_z = object.position.z;

                if (this._drawDebug2dAabb) {
                    object.traverse((o) => {
                        if (!o.isMesh) {
                            return;
                        }
                        this.drawObjectAabbDebug(id, o, object);
                    });
                }
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
        
        return this;
    }

    /**
     * "model" works only with "imported" gltf's wich does not have any internal links
     * @param id model asset id
     */
    async addModel(id: string, model: any) {
        const gltfurl = this.assets.get(model.gltf).info.url
        const textureurl = this.assets.get(model.texture).info.url

        if (!gltfurl || !textureurl) {
            throw new Error(
                `Load model errors: wrong ids 
                gltf = [${model.gltf}:${gltfurl}], 
                texture = [${model.texture}:${textureurl}]`
                )
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


        loader.load( gltfurl,  ( gltf ) => {
            gltf.scene.position.x = model.pos_x;
            gltf.scene.position.y = model.pos_y;
            gltf.scene.position.z = model.pos_z;
            gltf.scene.name = id;
            this.cache.models[id] = gltf.scene;
            this.scene.add( gltf.scene );

            const material = this.getMaterial(model.material, textureurl);
            gltf.scene.traverse((o) => {
                if (!o.isMesh) {
                    return;
                }

                o.material = material;
                
                // tmp. only gonna work for scenes with one mesh
                if (this._drawDebug2dAabb) {
                    this.drawObjectAabbDebug(id, o, gltf.scene);
                }
            });

           

            console.log(dumpObject(gltf.scene).join('\n'));
        }, undefined,  ( error ) => {
        
            console.error( error );
        
        } );
    }

    drawObjectAabbDebug(id: string, mesh: THREE.Mesh, transform_node: THREE.Object3D) {
        const box = this.scene_math.intersectAABBPlaneTo2dAabb(mesh.geometry, transform_node, this.colliders.origin, this.colliders.normal);
        if (!box) {
            if(this.cache.debug_colliders[id]) {
                this.scene.remove(this.cache.debug_colliders[id]);
                delete this.cache.debug_colliders[id];
                this.colliders.removeCollider(id);
            }
            return;
        }
        const collider = this.colliders.addBoxCollider(id, box);
        this.drawColliderDebug(id, collider);
    }

    drawColliderDebug(id: string, collider: BoxCollider) {
        let plane = this.cache.debug_colliders[id];
        if (!plane) {
            const geometry = new THREE.PlaneGeometry( collider.width, collider.height );
            // tynroar tmp todo: move material into cache
            const material = new THREE.MeshStandardMaterial( { color: 0x00ffff, wireframe: true } );
            plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
        }
        this.setPos(plane, new THREE.Vector3(collider.pos_x, collider.pos_y, this.colliders.origin.z))
        //plane.position.add(this.cache.models[id].position);
        //plane.position.z = this.colliders.origin.z;
        const planepos = (plane as any).position;
        plane.lookAt(planepos.x + this.colliders.normal.x, planepos.y + this.colliders.normal.y, this.colliders.origin.z + this.colliders.normal.z);
        this.cache.debug_colliders[id] = plane;
    }

    removeModel(id: string) {
        this.transform_controls.detach();
        if (!this.cache.models[id]) {
            throw new Error("SceneRender::removeModel: can't remove model " + id);
        }
        this.scene.remove(this.cache.models[id]);
        delete this.cache.models[id];
        if(this.cache.debug_colliders[id]) {
            this.scene.remove(this.cache.debug_colliders[id]);
            delete this.cache.debug_colliders[id];
        }
        this.colliders.remove(id);
    }
    clearModels() {
        this.transform_controls.detach();
        for(const k in this.cache.models) {
            this.removeModel(k)
        }
        while(this.cache.gltfs.length) {
            this.scene.remove(this.cache.gltfs.pop());
        }
        this.cache.models = {};
    }
    viewModel(id: string, model: any) {
        this.clearModels();
        this.addModel(id, model);
    }

    /**
     * Basic way to display model.
     * Resolves internal urls by asset name.
     * @param url gltf file url
     */
    viewGLTF(url: string) {
        this.clearModels();

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
            this.cache.gltfs.push(gltf.scene);
            console.log(dumpObject(gltf.scene).join('\n'));
        }, undefined,  ( error ) => {
        
            console.error( error );
        
        } );
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
        for(const k in this.colliders.bodies) {
            const body = this.colliders.bodies[k];
            this.drawColliderDebug(k, body.collider);
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

    private canvas: HTMLCanvasElement;
    private refSizeEl: HTMLElement | null | undefined;

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    private transform_controls: TransformControls;
    private mousepos: THREE.Vector2;
    private raycaster: THREE.Raycaster;

    private scene_math: SceneMath;
    assets: Assets;
    scene_edit: SceneEdit;
    private active: Boolean;
    private cache: SceneCache;

    colliders: SceneCollisions;

    _drawDebug2dAabb: boolean;

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
