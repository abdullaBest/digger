import * as THREE from './lib/three.module.js';

class AppCache {
    constructor() {
        this.vec2_0 = new THREE.Vector2();
    }
    vec2_0: THREE.Vector2
}

class App {
    constructor() {
        this.active = false;
        this.cache = new AppCache();
    }
    init() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
        const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("canvas#rootcanvas"), alpha: true });
        renderer.setSize( window.innerWidth, window.innerHeight );
        
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        const cube = new THREE.Mesh( geometry, material );
        scene.add( cube );
        
        camera.position.z = 5;

        this.cube = cube;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
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
        if (
            this.cache.vec2_0.width != window.innerWidth ||
            this.cache.vec2_0.height != window.innerHeight 
            ) {
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
            }
    }

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    private active: Boolean;
    private cache: AppCache;
}
export default App;