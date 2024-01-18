
import * as THREE from '../lib/three.module.js';
import SceneRenderLoader from './scene_render_loader.js';
import MapTileset from '../map_tileset.js';
import { focusCameraOn } from './render_utils.js';

export default class TilesetEditor {
    scene: THREE.Group;
    rootscene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    private cube: THREE.Mesh;

    palette_h: number;
    palette_w: number;

    loader: SceneRenderLoader;

    objects: { [id:string] : THREE.Object3D };

    slected_object: THREE.Object3D | null;

    constructor(loader: SceneRenderLoader) {
        this.palette_h = 512;
        this.palette_w = 64;
        this.loader = loader;
        this.objects = {};
    }

    init() : TilesetEditor {
        const rootscene = new THREE.Scene();
        const scene = new THREE.Group();

        rootscene.add(scene);
        const camera = new THREE.OrthographicCamera(-1,1, this.palette_h / this.palette_w, -this.palette_h / this.palette_w);
        (camera as any).position.z = 10;

        const geometry = new THREE.BoxGeometry( 0.1, 0.1, 0.1 );
        const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
        const cube = new THREE.Mesh( geometry, material );
        scene.add( cube );

        const light1 = new THREE.AmbientLight(0xffffff, 3.7);
		light1.name = 'ambient_light';
		camera.add(light1);
        const light2 = new THREE.DirectionalLight(0xffffff, 7.3);
		(light2 as any).position.set(0.5, 0, 0.866); // ~60º
		light2.name = 'main_light';
		rootscene.add(light2);
        
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.2);
        hemiLight.name = 'hemi_light';
        rootscene.add(hemiLight);

        this.cube = cube;
        this.scene = scene;
        this.rootscene = rootscene;
        this.camera = camera;

        return this;
    }

    step(dt: number) { 
        this.cube.rotateX(0.01);
        this.cube.rotateY(0.01);
    }

    cleanupPalette() {
        for(const k in this.objects) {
            this.objects[k].removeFromParent();
            delete this.objects[k];
        }
    }

    pickObject(id: string) {
        this.unpickObject();
        const o = this.objects[id];
        o.rotateY(45);
        (o as any).scale.addScalar(0.1);
        this.slected_object = o;
    }

    unpickObject() {
        if (!this.slected_object) {
            return;
        }
        this.slected_object.rotateY(-45);
        (this.slected_object as any).scale.subScalar(0.1);
        this.slected_object = null;
    }

    async drawPalette(tileset: MapTileset) {
        this.cleanupPalette();

        let index = 0;
        for(const id in tileset.models) {
            const m = tileset.models[id];
            const o = await this.loader.getModel(id, m);
            o.name = id;
            this.objects[id] = o;
            this.scene.add(o);
            (o as any).position.y = index-- * 2;
        }

        focusCameraOn(this.scene, this.camera);
    }

    discardPalette() {
        for(const k in this.objects) {
            this.objects[k].removeFromParent();
            delete this.objects[k];
        }

        this.slected_object = null;
    }
}