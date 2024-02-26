import { SceneCore } from "./scene_core";
import {
	SceneControllersSystem,
	SceneWireplugsSystem,
	MapEvent,
} from "../systems";
import { AssetContentTypeComponent } from "./assets";
import { RenderTilesetSystem } from "../systems/tileset_render_system";
import { printerror } from "../shell/infobox";
import logger from "../core/logger";

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
		this.scene_core.addSystem(
			"wireplugs",
			new SceneWireplugsSystem(this.scene_core)
		);
		this.scene_core.addSystem(
			"controllers",
			new SceneControllersSystem(this.scene_core)
		);
	}

	async add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	) {
		logger.log(`SceneMap: Adding component #${component.id} (${component.name})`)
		await this.scene_core.load(component);
		return this.scene_core.add(component, owner);
	}

	remove(component: AssetContentTypeComponent) {
		return this.scene_core.remove(component.id);
	}

	event(event: MapEvent) {
		this.scene_core.event(event);
	}

	cleanup() {
		try {
			this.scene_core.cleanup();
			this.setViewpoint(0, 0);
		} catch (err) {
			printerror(err.message);
		}
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
