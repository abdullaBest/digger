import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { OrbitControls } from './lib/OrbitControls.js'

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.models = [];
    }
    vec2_0: THREE.Vector2;
    models: Array<any>;
}

class Scene {
    constructor() {
        this.active = false;
        this.cache = new SceneCache();
    }
    init(canvas: HTMLCanvasElement) : Scene {
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
        
        (camera as any).position.z = 2;

        this.cube = cube;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.viewGLTF('/assets/load/a0_feb7598e4ae706a33a614f43330b9e7d/0');
        this.updateSize();
        
        return this;
    }
    viewGLTF(url: string) {
        while(this.cache.models.length) {
            this.scene.remove(this.cache.models.pop());
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
            this.cache.models.push(gltf.scene);
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

    private canvas: HTMLCanvasElement;
    private refSizeEl: HTMLElement | null | undefined;

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private controls: OrbitControls;


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

export default Scene;