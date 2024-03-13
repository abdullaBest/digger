import * as THREE from "../lib/three.module.js";
import SceneCore from "../app/scene_core";
import Character from "./character";
import SceneRender from "../render/scene_render";
import SceneCollisions from "../app/scene_collisions";
import { BoxColliderC } from "../app/scene_collisions";
import { clamp } from "../core/math";

interface BreakObjectData {
	max_durability: number;
	sprite: THREE.Mesh;
}

export default class SystemObjectsBreak {
	scene_core: SceneCore;
	breakable_objects: { [id: string]: BreakObjectData };
	scene_render: SceneRender;
	scene_collisions: SceneCollisions;

	crack_meshes: Array<THREE.Mesh>;

	constructor(scene_core: SceneCore, scene_render: SceneRender) {
		this.scene_core = scene_core;
		this.scene_render = scene_render;
		this.scene_collisions = scene_core.scene_collisions;
		this.crack_meshes = [];
	}

	async load() {
		if (this.crack_meshes.length) {
			return;
		}

		const load = async (name: string) => {
			const sprite = await this.scene_render.makeSprite3d(name);
			(sprite as any).position.z = 0.5;
			sprite.material.transparent = true;
			sprite.material.depthTest = false;

			return sprite;
		};

		const crack1 = await load("masks/dig-cracks-lvl1");
		const crack2 = await load("masks/dig-cracks-lvl2");
		const crack3 = await load("masks/dig-cracks-lvl3");

		this.crack_meshes.push(crack1, crack2, crack3);
	}

	run() {
		this.dispose();
	}

	dispose() {
		for (const k in this.breakable_objects) {
			const b = this.breakable_objects[k];
			if (b.sprite && b.sprite.parent) {
				b.sprite.removeFromParent();
			}
		}
		this.breakable_objects = {};
	}

	/**
	 *
	 * @param id {string} hit object
	 * @param damage {number} amound of damage made
	 * @param strength {number} damage threshold. When it less than object resistance no damage will be made
	 * @returns true if objet durability set and it less/equals zero
	 */
	hit(id: string, damage: number = 1, strength: number = 1): boolean {
		const hit_damage = damage;
		const hit_strength = strength;

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

		let durability = gameprop_component.durability as number;
		let resistance = gameprop_component.resistance;

		if (hit_strength < resistance) {
			return false;
		}

		let cached_info = this.breakable_objects[component.id];
		if (!cached_info) {
			cached_info = {
				max_durability: durability,
				sprite: this.crack_meshes[0].clone(),
			};
			const obj = this.scene_render.cache.objects[component.id];
			if (obj) {
				obj.add(cached_info.sprite);
			}
			this.breakable_objects[component.id] = cached_info;
		}

		durability = Math.max(0, durability - hit_damage);
		gameprop_component.durability = durability;

		if (durability > 0) {
			const damage_factor = 1 - durability / cached_info.max_durability;
			const sprite_index = clamp(
				Math.floor(damage_factor * this.crack_meshes.length),
				0,
				this.crack_meshes.length - 1
			);
			cached_info.sprite.material = this.crack_meshes[sprite_index].material;
		} else {
			delete this.breakable_objects[component.id];
			cached_info.sprite.removeFromParent();
		}

		return durability <= 0;
	}

	step(dt: number) {
		const shaketime = 0.1;
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
