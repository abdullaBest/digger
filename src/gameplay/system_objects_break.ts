import SceneCore from "../app/scene_core";
import Character from "./character";
import SceneRender from "../render/scene_render";
import SceneCollisions from "../app/scene_collisions";
import { BoxColliderC } from "../app/scene_collisions";

interface BreakObjectData {
	elapsed: number;
}

export default class SystemObjectsBreak {
	scene_core: SceneCore;
	breakable_objects: { [id: string]: BreakObjectData };
	scene_render: SceneRender;
	scene_collisions: SceneCollisions;
	constructor(scene_core: SceneCore, scene_render: SceneRender) {
		this.scene_core = scene_core;
		this.scene_render = scene_render;
		this.scene_collisions = scene_core.scene_collisions;
	}

	run() {
		this.breakable_objects = {};
	}

	/**
	 *
	 * @param id hit object
	 * @returns true if objet durability set and it less/equals zero
	 */
	hit(id: string): boolean {
		const hit_damage = 1;
		const hit_strength = 1;

		// hit result is collider. Breakable component has to be found somehere in tree
		let component = this.scene_core.components[id] as any;
		while (component && !component.gameprop && component.owner) {
			component = this.scene_core.matters.get(component.owner);
		}
		if (!component || !component.gameprop) {
			return false;
		}

		const gameprop_component = this.scene_core.matters.get(
			component.gameprop
		) as any;

		let durability = gameprop_component.durability;
		let resistance = gameprop_component.resistance;

		if (hit_strength < resistance) {
			return false;
		}

		durability -= hit_damage;

		gameprop_component.durability = Math.max(0, durability);
		this.breakable_objects[component.id] = { elapsed: 0 };
		return durability <= 0;
	}

	step(dt: number) {
		const shaketime = 0.1;
		for (const k in this.breakable_objects) {

			const component = this.scene_core.components[k] as any;
			const b = this.breakable_objects[k];
			b.elapsed += dt;

			const obj = this.scene_render.cache.objects[k];
			if (obj && b.elapsed < shaketime) {
				const refx = component.pos_x;
				const refy = component.pos_y;
				const x = refx + (Math.random() - 0.5) * 0.04;
				const y = refy + (Math.random() - 0.5) * 0.04;

				(obj as any).position.x = x;
				(obj as any).position.y = y;
			} else {
				delete this.breakable_objects[k];
				if (!obj) {
					continue;
				}
				(obj as any).position.x = component.pos_x;
				(obj as any).position.y = component.pos_y;
			}
		}
	}

	_actionHitCollisionTest(
		cha: Character,
		colliders: { [id: string]: BoxColliderC }
	): string | null {
		const tile_size = 1;
		const ray_size = tile_size * 0.9;
		// default in center
		let test_l = cha.body.collider.x;
		let test_r = cha.body.collider.x;
		let test_t = cha.body.collider.y;
		let test_b = cha.body.collider.y;

		// shift "ray" (boundbox actually) towards look x direction.
		// Y look direction in priority
		if (!cha.look_direction_y) {
			test_l =
				cha.body.collider.x +
				cha.body.collider.width * 0.5 * cha.look_direction_x +
				ray_size * cha.look_direction_x;
			test_r =
				cha.body.collider.x +
				cha.body.collider.width * 0.5 * cha.look_direction_x +
				ray_size * cha.look_direction_x;
			test_t = cha.body.collider._top - 0.01;
			test_b = cha.body.collider._bottom + 0.01;
		} else {
			test_t =
				cha.body.collider.y +
				cha.body.collider.height * 0.5 * cha.look_direction_y +
				ray_size * cha.look_direction_y;
			test_b =
				cha.body.collider.y +
				cha.body.collider.height * 0.5 * cha.look_direction_y +
				ray_size * cha.look_direction_y;
			test_r = cha.body.collider._right - 0.01;
			test_l = cha.body.collider._left + 0.01;
		}
		let hit_collider: string | null = null;
		let distance = Infinity;
		for (const k in colliders) {
			const c = colliders[k];
			const collides_x = test_l <= c._right && c._left <= test_r;
			const collides_y = test_b <= c._top && c._bottom <= test_t;
			if (collides_x && collides_y) {
				const dx = cha.body.collider.x - c.x;
				const dy = cha.body.collider.y - c.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < distance) {
					distance = dist;
					hit_collider = k;
				}
			}
		}

		return hit_collider;
	}
}
