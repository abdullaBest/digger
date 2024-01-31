import { SceneCore } from "./scene_core";
import { AssetContentTypeComponent } from './assets';
import { RenderTilesetSystem } from "./render/tileset_render_system";

export default class SceneMap {
    scene_core: SceneCore;
    render_tileset_system: RenderTilesetSystem;

    constructor(scene_core: SceneCore) {
        this.scene_core = scene_core;
    }

    init() {
        this.render_tileset_system = new RenderTilesetSystem(this.scene_core);
        this.scene_core.addSystem("render_tileset", this.render_tileset_system);
    }

    async add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {
        await this.scene_core.add(component, owner);
    }

    remove(component: AssetContentTypeComponent) {
        this.scene_core.remove(component.id);
    }

    cleanup() {
        this.scene_core.cleanup();
    }

    step(dt: number) {
        this.render_tileset_system.tileset_render.update(0, 0);
    }
}