import * as THREE from "../lib/three.module.js";
import SceneCore from "../app/scene_core";
import Random from "../lib/alea.js";

import { MapSystem } from ".";
import {
	AssetContentTypeComponent,
	AssetContentTypeModel,
	AssetContentTypeCollider,
	AssetContentTypeGameprop
} from "../app/assets";
import logger from "../core/logger";

/**
 * This system renders tilepack components wich holds batch of tile mesh pieces
 */
export default class DiggerGemsourceGenerationSystem extends MapSystem {
	private scene_core: SceneCore;
	private gemsource_zones: { [id: string]: AssetContentTypeComponent };
	private random: Random;

	constructor(scene_core: SceneCore) {
		super();
		// this system does not filter anything so priority not in use
		this.priority = 1;
		this.scene_core = scene_core;
		this.gemsource_zones = {};
		this.random = Random();
	}

	filter(component: AssetContentTypeComponent): boolean {
		return component.type == "gemsource";
	}

	add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {
		if (component.type == "gemsource") {
			this.gemsource_zones[component.id] = component;

			if (!component.get("collider")) {
				throw new Error(
					"component gemsource error: no 'collider' property found"
				);
			}
			if (!component.get("decor-gems")) {
				// this field lists gems that should be drawn within tiles
				throw new Error(
					"component gemsource error: no 'decor-gems' property found"
				);
			}
			if (!component.get("spawn-gems")) {
				// this field list gems that should be spawned after tile destuction
				throw new Error(
					"component gemsource error: no 'spawn-gems' property found"
				);
			}
		}

		if (component.type === "collider" && owner?.get("tileref")) {
			this.spawnGems(owner, component as AssetContentTypeCollider);
		}
	}

	spawnGems(
		component: AssetContentTypeComponent,
		collider: AssetContentTypeCollider
	) {
		const gameprop = this.scene_core.matters.get(component.get("gameprop")) as AssetContentTypeGameprop;

		if (!gameprop?.gemsource) {
			return;
		}

		const collider_a = this.scene_core.scene_collisions.colliders[collider.id];

		if (!collider_a) {
			return;
		}

		for (const k in this.gemsource_zones) {
			const zone = this.gemsource_zones[k];
			const collider_zone_component = this.scene_core.matters.get(
				zone.get("collider")
			);
			const collider_b =
				this.scene_core.scene_collisions.colliders[collider_zone_component.id];

			const collides = this.scene_core.scene_collisions.simpleAABBCollision(
				collider_a,
				collider_b
			);

			if (!collides) {
				continue;
			}

			this.random.seed(component.pos_x, component.pos_y);
			const rand = this.random();
			if (rand > 0.3) {
				continue;
			}

			const decorlist = zone.get("decor-gems").split(",");
			const spawnlist = zone.get("spawn-gems").split(",");

			const index = this.random.range(0, decorlist.length - 1);

			const newcomponent = this.scene_core.matters.get(
				zone.get(decorlist[index])
			) as AssetContentTypeComponent;

			const newinstance = this.scene_core.add(newcomponent, component, null, {
				abstract: false,
				pos_x: component.pos_x,
				pos_y: component.pos_y,
				// no link here, only direct id
				spawns: this.scene_core.matters.get(zone.get(spawnlist[index])).id
			});
			component.set_link("gemsource", newinstance.id);

			break;
		}
	}

	remove(component: AssetContentTypeModel) {
		if (component.type == "gemsource") {
			delete this.gemsource_zones[component.id];
		}
	}
}
