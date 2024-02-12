import { AssetContentTypeComponent } from "../assets";
import MapEvent from "./map_event";

class MapSystem {
	priority: number;
	constructor() {
		this.priority = 0;
	}
	async load(component: AssetContentTypeComponent) {}
	async add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent | null
	) {}
	remove(component: AssetContentTypeComponent) {}
	filter(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	): boolean {
		return false;
	}
	step(dt: number) {}
	event(event: MapEvent) {}
}

export default MapSystem;
export { MapSystem };
