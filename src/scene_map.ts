import { SceneCore } from "./scene_core";
import { AssetContentTypeComponent } from './assets';
import { RenderTilesetSystem } from "./render/tileset_render_system";

export default class SceneMap {
    scene_core: SceneCore;

    constructor(scene_core: SceneCore) {
        this.scene_core = scene_core;
    }

    init() {
        const render_tileset_system = new RenderTilesetSystem(this.scene_core);
        this.scene_core.addSystem("render_tileset", render_tileset_system);
    }

    async add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {
        await this.scene_core.add(component, owner);
    }

    remove(component: AssetContentTypeComponent) {
        this.scene_core.remove(component);
    }

    cleanup() {
        this.scene_core.cleanup();
    }
}