import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OrbitControls } from './lib/OrbitControls.js'
import { Assets } from './assets'
import SceneEdit from "./scene_edit";
import { TransformControls } from './lib/TransformControls.js';

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.gltfs = [];
    }
    vec2_0: THREE.Vector2;
    gltfs: Array<any>;
    models: { [id: string] : any; };
}

class SceneRender {
    constructor(scene_edit: SceneEdit) {
        this.scene_edit = scene_edit;
        this.assets = this.scene_edit.assets;
        this.active = false;
        this.cache = new SceneCache();
        this.mousepos = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
    }
    init(canvas: HTMLCanvasElement) : SceneRender {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
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
            const el = this.scene_edit.elements[id];
            if (el) {
                el.position.x = object.position.x;
                el.position.y = object.position.y;
                el.position.z = object.position.z;
            }
        });
        this.transform_controls.addEventListener( 'mouseDown', ( event ) => {
            this.controls.enabled = false;
        } );
        this.transform_controls.addEventListener( 'mouseUp',  ( event ) => {
            this.controls.enabled = true;
        } );
        scene.add(this.transform_controls);
        canvas.addEventListener('click', this.onMouseClick.bind(this));
        
        (camera as any).position.z = 2;

        this.cube = cube;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.updateSize();
        
        return this;
    }
    async addModel(id: string) {
        const model_element = this.scene_edit.elements[id];
        const model_asset_id = model_element.model;
        if (!model_asset_id) {
            throw new Error(`Can't add model ${id}. Element has no model data`);
        }
        const modelurl = this.assets.get(model_asset_id)?.info.url;
        if (!modelurl) {
            throw new Error(`Can't find model ${model_asset_id} for element ${id}`);
        }
        const modeldata = await (await fetch(modelurl)).json();

        const gltfurl = this.assets.get(modeldata.gltf)?.info.url
        const binurl = this.assets.get(modeldata.bin)?.info.url
        const textureurl = this.assets.get(modeldata.texture)?.info.url

        if (!gltfurl || !binurl || !textureurl) {
            throw new Error(
                `Load model errors: wrong ids 
                gltf = [${modeldata.gltf}:${gltfurl}], 
                bin = [${modeldata.bin}:${binurl}], 
                texture = [${modeldata.texture}:${textureurl}]`
                )
        }

        console.log(gltfurl, binurl, textureurl);

        const loading_manager = new THREE.LoadingManager();
        const loader = new GLTFLoader(loading_manager);
        loading_manager.setURLModifier((path: string) => {
            if (path.includes(".bin")) {
                return binurl;
            } else if (path.includes(".png")) {
                return textureurl;
            }

            return gltfurl;
        })


        loader.load( gltfurl,  ( gltf ) => {
            gltf.scene.name = id;
            gltf.scene.position.x = model_element.position.x;
            gltf.scene.position.y = model_element.position.y;
            gltf.scene.position.z = model_element.position.z;
            this.scene.add( gltf.scene );
            this.cache.models[id] = gltf.scene;
            console.log(dumpObject(gltf.scene).join('\n'));
        }, undefined,  ( error ) => {
        
            console.error( error );
        
        } );
    }
    clearModels() {
        this.transform_controls.detach();
        for(const k in this.cache.models) {
            this.scene.remove(this.cache.models[k])
        }
        this.cache.models = {};
    }
    viewGLTF(url: string) {
        while(this.cache.gltfs.length) {
            this.scene.remove(this.cache.gltfs.pop());
        }

        const loading_manager = new THREE.LoadingManager();
        const loader = new GLTFLoader(loading_manager);
        loading_manager.setURLModifier((path: string) => {
            // 1. Loads model itself. Leave it as it
            if (path.includes(url)) {
                return path;
            }
            // 2. Loads model dependencies. Replace it with custom path
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
    dispose() {
        this.stop();
    }
    run() {
        this.active = true;
        this.loop();
    }
    stop() {
        this.active = false;
    }
    private loop() {
        if (!this.active) {
            return;
        }

        this.updateSize();

        this.cube.rotateX(0.01);
        this.cube.rotateY(0.01);
    
        this.renderer.render( this.scene, this.camera );

        requestAnimationFrame( this.loop.bind(this) );
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
        console.log(event);
        this.mousepos.x = ( event.layerX / event.target.offsetWidth ) * 2 - 1;
        this.mousepos.y = - ( event.layerY / event.target.offsetHeight ) * 2 + 1;
        this.raycaster.setFromCamera( this.mousepos, this.camera );
        const intersects = this.raycaster.intersectObjects( this.scene.children, true );
        console.log("raycasting")

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
            console.log("transform attaced to " + model.name)
            this.transform_controls.attach(model);
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

    private assets: Assets;
    private scene_edit: SceneEdit;
    private active: Boolean;
    private cache: SceneCache;
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