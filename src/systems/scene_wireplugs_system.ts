import {
	AssetContentTypeComponent,
	AssetContentTypeWireplug,
	AssetContentTypeTimer,
} from "../assets";
import SceneCore from "../scene_core";
import MapSystem from "./map_system";
import { MapEvent, MapEventCode } from "./map_event";

interface AssetRuntimeTypeWireplug extends AssetContentTypeWireplug {
	activated: boolean;
	activations: number;
	timer_elapsed: number;
	timer_event_code: MapEventCode;
}

export default class SceneWireplugsSystem extends MapSystem {
	priority: number;
	scene_core: SceneCore;
	timers: { [id: string]: AssetContentTypeWireplug };

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
			// time counted
			const elapsed = timer.set(
				"timer_elapsed",
				timer.get("timer_elapsed") + dt
			) as number;
			// time required
			const delay =
				timer.get("timer_event_code") === MapEventCode.START
					? timer.hold
					: timer.release;
			if (delay <= elapsed) {
				this._finishTimer(timer, {
					component: timer.owner,
					code: timer.get("timer_event_code"),
				});
				delete this.timers[k];
			}
		}
	}

	event(event: MapEvent, check_timers: boolean = true) {
		// wireplugs does not accept default event codes
		if (event.code === MapEventCode.DEFAULT) {
			return;
		}

		const components = this.scene_core.components;
		const matters = this.scene_core.matters;

		const component = components[event.component];
		const wireplug = matters.get(
			component.get("wireplug")
		) as AssetContentTypeWireplug;

		if (!wireplug) {
			return;
		}

		// propagate event on wires
		const key = "activations";
		const activations = wireplug.get(key) ?? 0;
		const counter = event.code == MapEventCode.START ? 1 : -1;
		wireplug.set(key, activations + counter);

		// propagate only when state changed

		if (
			(activations > 0 && event.code === MapEventCode.START) ||
			(activations < 1 && event.code === MapEventCode.END)
		) {
			return;
		}

		if (this._runTimer(wireplug, event)) {
			return;
		}

		this._finishTimer(wireplug, event);

		/*
		if (wireplug.filter) {
			const f = wireplug.filter.toLowerCase();
			switch (f) {
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
	 */
	}

	_finishTimer(wireplug: AssetContentTypeWireplug, event: MapEvent) {
		// count input activations
		const was_activated = wireplug.get("activated") ?? false;
		const now_activated = wireplug.set(
			"activated",
			wireplug.get("activations") && event.code === MapEventCode.START
		);

		console.log(was_activated, now_activated);

		if (was_activated == now_activated) {
			return;
		}

		this._propagate(wireplug, event);
	}

	_runTimer(wireplug: AssetContentTypeWireplug, event: MapEvent): boolean {
		if (!wireplug) {
			return false;
		}

		// delete timer each event - we don't want false triggers
		delete this.timers[wireplug.id];

		const delay =
			event.code === MapEventCode.START ? wireplug.hold : wireplug.release;

		if (delay) {
			this.timers[wireplug.id] = wireplug;
			wireplug.set("timer_elapsed", 0);
			wireplug.set("timer_event_code", event.code);
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
				const e = Object.assign({}, event);
				e.component = ncomponent.id;
				this.scene_core.event(e);
			}
		}
	}
}
