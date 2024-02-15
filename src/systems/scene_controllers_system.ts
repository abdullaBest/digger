import {
	AssetContentTypeComponent,
	AssetContentTypeController,
} from "../assets";
import MapSystem from "./map_system";
import SceneCore from "../scene_core";
import { MapEvent, MapEventCode } from "./map_event";

export default class SceneControllersSystem extends MapSystem {
	scene_core: SceneCore;
	components: { [id: string]: AssetContentTypeController };
	constructor(scene_core: SceneCore) {
		super();

		this.scene_core = scene_core;
		this.components = {};
	}

	async add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}

		this.components[component.id] = component as AssetContentTypeController;
	}
	remove(component: AssetContentTypeComponent) {
		delete this.components[component.id];
	}
	filter(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "controller";
	}
	event(event: MapEvent) {
		const component = this.scene_core.components[event.component];
		const controller = this.scene_core.matters.get(
			component.get("controller")
		) as AssetContentTypeController;
		if (!controller) {
			return;
		}
		const hide = controller.hide.replace(" ", "").split(",");
		for (const i in hide) {
			const key = hide[i];
			const id = component[key];
			if (!id) {
				continue;
			}
			const tohide = this.scene_core.matters.get(id);
			if (!tohide) {
				continue;
			}

			if (event.code == MapEventCode.START) {
				this.scene_core.hide(tohide.id);
			} else if (event.code == MapEventCode.END) {
				this.scene_core.show(tohide.id);
			}
		}
	}
}
