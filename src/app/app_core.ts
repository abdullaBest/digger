import Assets from "./assets";
import SceneRender from "../render/scene_render";
import SceneCollisions from "./scene_collisions";
import SceneCore from "./scene_core";
import SceneMap from "./scene_map";

/**
 * @brief contains generic classes such assets, render and collisions
 */
export default class AppCore {
	assets: Assets;
	scene_render: SceneRender;
	scene_collisions: SceneCollisions;
	scene_core: SceneCore;
	scene_map: SceneMap;

	constructor() {
		this.assets = new Assets();
		this.scene_collisions = new SceneCollisions();
		this.scene_render = new SceneRender(this.assets);

		this.scene_core = new SceneCore(
			this.assets.matters,
			this.scene_collisions,
			this.scene_render
		);

		this.scene_map = new SceneMap(this.scene_core);
	}

	init() {
		const canvas = document.querySelector("canvas#rootcanvas");
		if (!canvas) {
			throw new Error("can't find canvas to render");
		}

		this.assets.init();
		this.scene_render.init(canvas as HTMLCanvasElement);
	}

	async load() {
		await this.assets.load();
	}


	step(dt: number) {
		this.scene_render.step(dt);
		this.scene_render.render();
	}
}
