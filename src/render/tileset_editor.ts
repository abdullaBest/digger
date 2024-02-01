
import * as THREE from '../lib/three.module.js';
import SceneRenderLoader from './scene_render_loader.js';
import MapTileset from '../systems/map_tileset_system.js';
import { focusCameraOn } from './render_utils.js';
import SceneCore from '../scene_core.js';
import { AssetContentTypeModel } from '../assets.js';

export default class TilesetEditor {
    scene: THREE.Group;
    rootscene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    private cube: THREE.Mesh;

    palette_h: number;
    palette_w: number;

    tilesize_x: number;
    tilesize_y: number;

    loader: SceneRenderLoader;
    scene_core: SceneCore;

    objects: { [id:string] : THREE.Object3D };
    colors: { [id:string] : string }

    slected_object: THREE.Object3D | null;
    selected_tileset: string | null;
    changed_tilesets:  { [id:string] : number };

    constructor(scene_core: SceneCore, loader: SceneRenderLoader) {
        this.palette_h = 512;
        this.palette_w = 64;
        this.tilesize_x = 1;
        this.tilesize_y = 1;
        this.loader = loader;
        this.objects = {};
        this.colors = {};
        this.changed_tilesets = {};
        this.scene_core = scene_core;
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

    cleanup() {
        this.changed_tilesets = {};
        this.cleanupPalette();
    }

    cleanupPalette() {
        for(const k in this.objects) {
            this.objects[k].removeFromParent();
            delete this.objects[k];
        }

        this.slected_object = null;
        this.selected_tileset = null;
        this.colors = {};
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

        this.tilesize_x = tileset.tileset.tilesize_x;
        this.tilesize_y = tileset.tileset.tilesize_y;
        this.selected_tileset = tileset.tileset.id;

        let index = 0;
        for(const id in tileset.components) {
            const matter = this.scene_core.matters.get(id);
            let model : AssetContentTypeModel | null = null;
            this.scene_core.matters.traverse(id, null, (m) => { if (m.inherited_equals("type", "model")) { model = m as AssetContentTypeModel } });
            if (!model) {
                continue;
            }
            const o = await this.loader.getModel(id, model);
            o.name = id;
            this.objects[id] = o;
            this.colors[id] = tileset.colors[id]
            this.scene.add(o);
            (o as any).position.y = index-- * 2;
        }

        focusCameraOn(this.scene, this.camera);
    }
}