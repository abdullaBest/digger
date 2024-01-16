import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';
import { OrbitControls } from '../lib/OrbitControls.js'
import { Assets } from '../assets.js'
import { SceneEdit, SceneElement, SceneEditUtils } from "../scene_edit.js";
import { TransformControls } from '../lib/TransformControls.js';
import SceneMath from '../scene_math.js';
import { SceneCollisions, BoxColliderC, ColliderType } from '../scene_collisions.js';
import { lerp, distlerp } from '../math.js';
import TilesetEditor from './tileset_editor.js';
import SceneRenderCache from './scene_render_cache.js';
import SceneRenderLoader from './scene_render_loader.js';

const SPRITE_DEFAULT_PATH = "./res/icons/";


class SceneRender {
    canvas: HTMLCanvasElement;
    private refSizeEl: HTMLElement | null | undefined;

    camera_base_fov: number;

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private rootscene: THREE.Scene;
    scene: THREE.Group;
    camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;
    transform_controls: TransformControls;
    private mousepos: THREE.Vector2;
    private raycaster: THREE.Raycaster;

    private scene_math: SceneMath;
    assets: Assets;
    scene_edit: SceneEdit;
    private active: Boolean;
    cache: SceneRenderCache;
    loader: SceneRenderLoader;

    _drawDebug2dAabb: boolean;

    tileset_editor: TilesetEditor;

    constructor(scene_edit: SceneEdit) {
        this.scene_edit = scene_edit;
        this.assets = this.scene_edit.assets;
        this.active = false;
        this.cache = new SceneRenderCache();
        this.mousepos = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.scene_math = new SceneMath();
        this._drawDebug2dAabb = false;
        this.loader = new SceneRenderLoader(this.assets, this.cache);
        this.tileset_editor = new TilesetEditor(this.loader);
        this.camera_base_fov = 45;
    }
    init(canvas: HTMLCanvasElement) : SceneRender {
        const rootscene = new THREE.Scene();
        const scene = new THREE.Group();
        rootscene.add(scene);
        const camera = new THREE.PerspectiveCamera( this.camera_base_fov, window.innerWidth / window.innerHeight, 0.1, 1000 );
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
		rootscene.add(light2);
        
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 1.2);
        hemiLight.name = 'hemi_light';
        rootscene.add(hemiLight);

        this.controls = new OrbitControls(camera, renderer.domElement);
		this.controls.screenSpacePanning = true;

        this.transform_controls = new TransformControls( camera, renderer.domElement );
        this.transform_controls.addEventListener( 'objectChange', (e) => {
            const object = e.target.object as THREE.Object3D;
            const id = object.name;
            const el = this.scene_edit.elements && this.scene_edit.elements[id];

            let mproperties = this.cache.models[id] ?? this.cache.triggers[id];

            if (mproperties) {
                mproperties.matrix = object.matrixWorld.toArray()
            } else if (el && el.components.trigger) {
                mproperties = el.components.trigger.properties;

                const pos_x = (object as any).position.x;
                const pos_y = (object as any).position.y;
                mproperties.pos_x = pos_x;
                mproperties.pos_y = pos_y;
            }
        });
        this.transform_controls.addEventListener( 'mouseDown', ( event ) => {
            this.controls.enabled = false;
        } );
        this.transform_controls.addEventListener( 'mouseUp',  ( event ) => {
            this.controls.enabled = true;
        } );
        rootscene.add(this.transform_controls);

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
        this.rootscene = rootscene;
        this.camera = camera;

        this.updateSize();
        //this.test();

        this.tileset_editor.init();
       
        return this;
    }

    async addModel(id: string, model: any, cache_id: string = id) : Promise<THREE.Object3D> {
        const object = await this.loader.getModel(id, model);
        this.cache.objects[id] = object;
        this.scene.add( object );

        return object;
    }

    async addTriggerElement(id: string, properties: any) {
        const type = properties.type;
        const spritenames = {
            "mapentry": "character_place",
            "mapexit": "character_lift",
            "unknown": "hexagon_question",
        }
        let spritename = spritenames[type] || spritenames.unknown;

        const sprite = await this.makeSprite(spritename);

        sprite.name = id;
        this.scene.add(sprite);
        this.cache.triggers[id] = properties;
        this.cache.objects[id] = sprite;

        if (properties.pos_x || properties.pos_y) {
            this.setPos(sprite, this.cache.vec3_0.set(properties.pos_x ?? 0, properties.pos_y ?? 0, 0))
        }
    }

    async makeSprite(name: string): Promise<THREE.Sprite> {
        const spritepath = SPRITE_DEFAULT_PATH + name + ".png";
        return new THREE.Sprite( await this.getMaterial("sprite", spritepath, true) as THREE.SpriteMaterial);
    }

    produceObjectCollider(id: string, obj: THREE.Object3D, scene_origin: THREE.Vector3, scene_normal: THREE.Vector3) : THREE.Box2 | null {
        let box: THREE.Box2 | null = null;
        obj.traverse((o) => {
            if (!o.isMesh) {
                return;
            }
            const _box = this.scene_math.intersectAABBPlaneTo2dAabb(o.geometry, obj, scene_origin, scene_normal);
            if (!box && _box) {
                box = _box;
            }

            if (box && _box) {
                box.min.x = Math.min(box.min.x, _box.min.x)
                box.min.y = Math.min(box.min.y, _box.min.y)
                box.max.x = Math.min(box.max.x, _box.max.x)
                box.max.y = Math.min(box.max.y, _box.max.y)
            } 
        });

        return box;
    }

    drawColliderDebug(id: string, collider: BoxColliderC, color?: number, shift?: THREE.Vector2) {
        let plane = this.cache.debug_colliders[id];

        color = color ?? collider.type == ColliderType.RIGID ? 0x00ffff : 0xff00ff;

        if (!plane) {
            const geometry = new THREE.PlaneGeometry( 1, 1 );
            // tynroar tmp todo: move material into cache
            const material = new THREE.MeshStandardMaterial( { color, wireframe: true } );
            plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
        }

        let shift_x = 0;
        let shift_y = 0;
        if (shift) {
            shift_x = shift.x;
            shift_y = shift.y;
        }

        this.setPos(plane, new THREE.Vector3(collider.x + shift_x, collider.y + shift_y, this.colliders.origin.z))
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
            this.cache.objects[id].removeFromParent();
            delete this.cache.objects[id];
        }
        delete this.cache.models[id];
    }

    /**
     * removes anything that could be found with required id
     * @param id 
     */
    removeElement(id: string) {
        this.removeModel(id);
        delete this.cache.triggers[id];
    }

    clearTiggers() {
        for (const k in this.cache.triggers) {
            this.removeElement(k);
        }
    }

    clearCached() {
        this.clearModels();
        this.clearTiggers();
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
    async viewModel(id: string, model: any) {
        this.clearCached();
        const scene = await this.addModel(id, model);
        this.focusCameraOn(scene);
    }

    addGLTF(url: string, name?: string) : Promise<any> {
        return new Promise((resolve, reject) => {
            const loading_manager = new THREE.LoadingManager();
            const loader = new GLTFLoader(loading_manager);
            loading_manager.setURLModifier((path: string) => {
                // 0. blobbed data. Leave as it is
                if (path.includes('data:application/octet-stream') || path.includes('data:image') || path.includes('blob')) {
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
        this.clearCached();
        const gltf = await this.addGLTF(url);
        this.focusCameraOn(gltf.scene)
        return gltf;
    }

    focusCameraOn(object: THREE.Object3D) {
        const box = new THREE.Box3().setFromObject( object );
        const center = box.getCenter(new THREE.Vector3())
        const sphere = box.getBoundingSphere(new THREE.Sphere(center));

        const pos = new THREE.Vector3(1, 1, 1).multiplyScalar(sphere.radius + Math.log(sphere.radius * 1.3));
        this.setCameraPos(pos, center);
    }

    /**
     * Creates new material or finds it in cache
     * @param name material name
     * @param texture_url path to lexture
     */
    async getMaterial(name: string, texture_url: string, flipY: boolean = false) : Promise<THREE.Material> {
        return this.loader.getMaterial(name, texture_url, flipY);
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
    step(dt: number) {
        if (!this.active) {
            return;
        }

        this.updateSize();

        this.cube.rotateX(0.01);
        this.cube.rotateY(0.01);
        /*
        for(const k in this.colliders.bodies) {
            const body = this.colliders.bodies[k];
            const obj = this.cache.objects[k];
            if (obj && this.cache.models[k]) {
                const x = distlerp(obj.position.x, body.collider.x, 0.01, 3);
                const y = distlerp(obj.position.y, body.collider.y, 0.01, 3);
                obj.position.x  = x;
                obj.position.y  = y;
            }
            if(this._drawDebug2dAabb && body.collider) {
                this.drawColliderDebug(k, body.collider);
                //this.drawColliderDebug(k + "_predict", body.collider, 0xff0000, this.colliders.getBodyNextShift(body, this.cache.vec2_0));
            }
        }*/

        this.tileset_editor.step(dt);
    
        this.render();
    }

    render() {
        const width = this.getRenderWidth();
        const height = this.getRenderHeight();

        // main scene render
        this.renderer.autoClear = true;
        this.renderer.setViewport(0, 0, width, 
            height);
        this.renderer.render( this.rootscene, this.camera );

        // render ui
        const padding = 16;
        this.renderer.clearDepth();
        /*
        this.renderer.setScissorTest(true);
        this.renderer.setScissor(
            width - this.tileset_editor.palette_w - padding,
            height - this.tileset_editor.palette_h - padding,
            this.tileset_editor.palette_w,
            this.tileset_editor.palette_h
        );
        */
        this.renderer.setViewport(
            width - this.tileset_editor.palette_w - padding,
            height - this.tileset_editor.palette_h - padding,
            this.tileset_editor.palette_w,
            this.tileset_editor.palette_h
        );
        this.renderer.autoClear = false;
        this.renderer.render(this.tileset_editor.rootscene, this.tileset_editor.camera);
        //this.renderer.setScissorTest(false);
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

    getRenderWidth() {
        return Math.floor(this.refSizeEl?.offsetWidth || 100);
    }

    getRenderHeight() {
        return Math.floor(this.refSizeEl?.offsetHeight || 100);
    }

    private updateSize() {
        this.renderer.getSize(this.cache.vec2_0);
        const width = this.getRenderWidth();
        const height = this.getRenderHeight();
        if (
            this.cache.vec2_0.width != width ||
            this.cache.vec2_0.height != height 
            ) {
                this.renderer.setSize(width, height);
                this.updateCameraAspect(width, height);
            }
    }

    updateCameraAspect(width = this.getRenderWidth(), height = this.getRenderHeight()) {
        this.camera.aspect = width / height;
        this.camera.fov = this.camera_base_fov * Math.min(1, width / height);
        this.camera.updateProjectionMatrix();
    }

    onMouseClick( event ) {
        event.preventDefault();
        this.mousepos.x = ( event.layerX / event.target.offsetWidth ) * 2 - 1;
        this.mousepos.y = - ( event.layerY / event.target.offsetHeight ) * 2 + 1;
        this.raycaster.setFromCamera( this.mousepos, this.camera );
        const intersects = this.raycaster.intersectObjects( this.scene.children, true );

        let object: THREE.Object3D | null = null;
        for(const i in intersects) {
            const intersect = intersects[i];
            let o = intersect.object;
            while(o) {
                if (this.cache.models[o.name] || this.cache.triggers[o.name]) {
                    object = o;
                    break;
                }
                o = o.parent;
            } 
            if (object) {
                break;
            }
        }

        if ( object ) {
            console.log("transform attached to " + object.name)
            this.transform_controls.attach(object);
        }

    }

    /**
     * 
     * @param id model id
     */
    attachTransformControls(id: string) {
        const object = this.cache.objects[id];
        if (object) {
            this.transform_controls.attach(object);
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

    setCameraPos(pos: THREE.Vector3, target: THREE.Vector3) {
        this.setPos(this.camera, pos);
        this.camera.lookAt(target.x, target.y, target.z);
        this.controls.target.copy(target);
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
