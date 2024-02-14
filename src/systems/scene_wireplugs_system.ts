import {
	AssetContentTypeComponent,
	AssetContentTypeWireplug,
	AssetContentTypeTimer,
} from "../assets";
import SceneCore from "../scene_core";
import MapSystem from "./map_system";
import { MapEvent, MapEventCode } from "./map_event";

export default class SceneWireplugsSystem extends MapSystem {
	priority: number;
	scene_core: SceneCore;
	timers: { [id: string]: AssetContentTypeTimer };

	constructor(scene_core: SceneCore) {
		super();

		this.scene_core = scene_core;
		this.timers = {};
		this.priority = 0;
	}
	async add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}
	}
	remove(component: AssetContentTypeComponent) {}
	filter(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "wireplug";
	}

	step(dt: number) {
		for (const k in this.timers) {
			const timer = this.timers[k];
			const elapsed = timer.set("elapsed", timer.get("elapsed") + dt) as number;
			if (timer.delay && timer.delay <= elapsed) {
				this.event(
					{ component: timer.owner, code: timer.get("event_code") },
					false
				);
				delete this.timers[k];
			}
		}
	}

	event(event: MapEvent, check_timers: boolean = true) {
		const components = this.scene_core.components;
		const matters = this.scene_core.matters;

		// propagate event on wires
		const component = components[event.component];
		const wireplug = matters.get(
			component.get("wireplug")
		) as AssetContentTypeWireplug;

		if (wireplug.filter) {
			const f = wireplug.filter.toLowerCase();
			switch(f) {
				case "on":
					if (event.code != MapEventCode.START) {
						return;
					}
					break;
				case "off":
					if (event.code != MapEventCode.END) {
						return;
					}
					break;
				default:
					break;
			}
		}

		const timer = matters.get(component.get("timer")) as AssetContentTypeTimer;
		if (wireplug) {
			if (!check_timers || !this._runTimer(timer, event)) {
				this._propagate(wireplug, event);
			}
		}
	}

	_runTimer(timer: AssetContentTypeTimer | null, event: MapEvent): boolean {
		if (!timer) {
			return false;
		}

		if (timer.interval || timer.delay) {
			this.timers[timer.id] = timer;
			timer.set("elapsed", 0);
			timer.set("event_code", event.code);
			return true;
		}

		return false;
	}

	_propagate(wireplug: AssetContentTypeWireplug, event: MapEvent) {
		const csources = this.scene_core.csources;
		for (let i = wireplug.get("guids") - 1; i >= 0; i--) {
			const key = "e_" + i;
			const id = wireplug.get(key);
			const ncomponent = csources[id];
			if (ncomponent) {
				const e = Object.create(event);
				e.component = ncomponent.id;
				this.scene_core.event(e);
			}
		}
	}
}
