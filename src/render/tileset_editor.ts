
import * as THREE from '../lib/three.module.js';
import SceneRenderLoader from './scene_render_loader.js';

export default class TilesetEditor {
    scene: THREE.Group;
    rootscene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    private cube: THREE.Mesh;

    palette_h: number;
    palette_w: number;

    loader: SceneRenderLoader;

    constructor(loader: SceneRenderLoader) {
        this.palette_h = 512;
        this.palette_w = 64;
        this.loader = loader;
    }

    init() : TilesetEditor {
        const rootscene = new THREE.Scene();
        const scene = new THREE.Group();

        rootscene.add(scene);
        const camera = new THREE.PerspectiveCamera( 45, this.palette_w / this.palette_h, 0.1, 1000 );
        (camera as any).position.z = 2;

        const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
        const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
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

        this.cube = cube;
        this.scene = scene;
        this.rootscene = rootscene;
        this.camera = camera;

        camera.aspect = this.palette_w / this.palette_h;
        camera.updateProjectionMatrix();

        return this;
    }

    step(dt: number) { 
        this.cube.rotateX(0.01);
        this.cube.rotateY(0.01);
    }
}