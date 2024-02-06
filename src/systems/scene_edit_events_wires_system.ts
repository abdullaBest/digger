import MapSystem from "./map_system";
import { AssetContentTypeComponent, AssetContentTypeEvents } from "../assets.js";
import SceneRender from "../render/scene_render.js";

export default class SceneEditEventWiresSystem extends MapSystem {
	scene_render: SceneRender;
	constructor(scene_render: SceneRender) {
		super();

		this.scene_render = scene_render;
	}

	filter(
		component: AssetContentTypeEvents,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "events";
	}
	async add(
		component: AssetContentTypeEvents,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}	

		console.log(component);
	}
	remove(component: AssetContentTypeComponent) {}
	step(dt: number) {}
}
