import * as THREE from './lib/three.module.js';

class App {
    constructor() {
        this.active = false;
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

        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;
    
        this.renderer.render( this.scene, this.camera );

        requestAnimationFrame( this.loop.bind(this) );
    }

    private cube: THREE.Mesh;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;

    private active: Boolean;
}
export default App;