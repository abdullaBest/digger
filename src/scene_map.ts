import { SceneCore } from "./scene_core";
import { MapEvent } from "./systems";
import { AssetContentTypeComponent } from "./assets";
import { RenderTilesetSystem } from "./render/tileset_render_system";

export default class SceneMap {
	scene_core: SceneCore;
	render_tileset_system: RenderTilesetSystem;

	viewpoint_x: number;
	viewpoint_y: number;

	constructor(scene_core: SceneCore) {
		this.scene_core = scene_core;

		this.viewpoint_x = 0;
		this.viewpoint_y = 0;
	}

	init() {
		this.render_tileset_system = new RenderTilesetSystem(this.scene_core);
		this.scene_core.addSystem("render_tileset", this.render_tileset_system);
	}

	async add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	) {
		return await this.scene_core.add(component, owner);
	}

	remove(component: AssetContentTypeComponent) {
		return this.scene_core.remove(component.id);
	}

	event(event: MapEvent) {
		this.scene_core.event(event);
	}

	cleanup() {
		this.scene_core.cleanup();
		this.setViewpoint(0, 0);
	}

	step(dt: number) {
		if (this.render_tileset_system.tileset_render.clip_tiles_draw) {
			this.render_tileset_system.tileset_render.update(
				this.viewpoint_x,
				this.viewpoint_y
			);
		}
		this.scene_core.step(dt);
	}

	setViewpoint(x: number, y: number) {
		this.viewpoint_x = x;
		this.viewpoint_y = y;
	}

	clipTilesDraw(clip: boolean) {
		this.render_tileset_system.tileset_render.clip_tiles_draw = clip;
		this.render_tileset_system.tileset_render.update(
			this.viewpoint_x,
			this.viewpoint_y
		);
	}
}
