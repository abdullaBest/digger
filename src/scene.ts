import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OrbitControls } from './lib/OrbitControls.js'
import { Assets } from './assets'
import { SceneEdit, SceneElement } from "./scene_edit";
import { TransformControls } from './lib/TransformControls.js';

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.gltfs = [];
        this.models = {};
        this.materials = {};
    }
    
    vec2_0: THREE.Vector2;
    gltfs: Array<any>;
    models: { [id: string] : any; };
    materials: { [id: string] : THREE.Material; };
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
                if (o.isMesh) o.material = material;
            });

            console.log(dumpObject(gltf.scene).join('\n'));
        }, undefined,  ( error ) => {
        
            console.error( error );
        
        } );
    }
    removeModel(id: string) {
        this.transform_controls.detach();
        if (!this.cache.models[id]) {
            throw new Error("SceneRender::removeModel: can't remove model " + id);
        }
        this.scene.remove(this.cache.models[id]);
        delete this.cache.models[id];
    }
    clearModels() {
        this.transform_controls.detach();
        for(const k in this.cache.models) {
            this.scene.remove(this.cache.models[k])
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

    assets: Assets;
    scene_edit: SceneEdit;
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