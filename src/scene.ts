import * as THREE from './lib/three.module.js';

class SceneCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
    }
    vec2_0: THREE.Vector2;
}

class Scene {
    constructor() {
        this.active = false;
        this.cache = new SceneCache();
    }
    init() : Scene {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        const canvas = document.querySelector("canvas#rootcanvas");
        const renderer = new THREE.WebGLRenderer({ canvas , alpha: true });
        this.refSizeEl = canvas?.parentElement;

        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        const cube = new THREE.Mesh( geometry, material );
        scene.add( cube );
        
        (camera as any).position.z = 5;

        this.cube = cube;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.updateSize();
        
        return this;
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

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private refSizeEl: HTMLElement | null | undefined;

    private active: Boolean;
    private cache: SceneCache;
}
export default Scene;