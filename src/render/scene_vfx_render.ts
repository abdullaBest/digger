import * as THREE from "../lib/three.module.js";
import SceneRender from "./scene_render";
import { SceneCollisions } from "../app/scene_collisions";

class Particle {
	sprite: THREE.Sprite;
	elapsed: number;
	lifitime: number;
	size: number;
	vx: number;
	vy: number;
	physics: boolean;

	constructor(sprite: THREE.Spite, lifitime: number, size: number) {
		this.sprite = sprite;
		this.elapsed = 0;
		this.lifitime = lifitime;
		this.size = size;
		this.vx = 0;
		this.vy = 0;
		this.physics = false;
	}
}

function easeBackOut(t: number, amount: number) {
	return --t * t * ((amount + 1) * t + amount) + 1;
}

export default class SceneVfxRender {
	scene_render: SceneRender;
	scene_collisions: SceneCollisions;

	sprite_star_ref: THREE.Sprite;
	sprite_dollar_ref: THREE.Sprite;
	particles_stars: { [id: string]: Particle };

	constructor(scene_render: SceneRender, scene_collisions: SceneCollisions) {
		this.scene_render = scene_render;
		this.scene_collisions = scene_collisions;
		this.particles_stars = {};
	}

	async load() {
		this.sprite_star_ref = await this.scene_render.makeSprite("star");
		this.sprite_dollar_ref = await this.scene_render.makeSprite("dollar");
	}

	spawnStarParticle_01(pos: THREE.Vector3, dir: THREE.Vector3, strength: number = 1) {
		const star_lifetime = 0.7;
		const star_scale = 0.5;
		strength = Math.min(Math.log(Math.max(1, strength)) + 1, 10);

		const amount = Math.random() * 4 + 4 + strength;

		for (let i = 0; i < amount; i++) {
			const sprite = this.sprite_star_ref.clone();
			const id = "i" + sprite.id;
			const rfactor = i / amount;

			const physics = Math.random() > 0.5;
			const pfactor = physics ? 2 : 1;

			// ~[0.05,1.95]
			const r1 = 1 - (Math.random() - 0.5) * 1.9 * rfactor;
			// [0.1, 1]
			const r2 = 1 - Math.random() * 0.9 * rfactor;
			// [-0.5,0.5]
			const r3 = (Math.random() - 0.5) * rfactor;
			const r4 = (Math.random() - 0.5) * rfactor;

			const lifitime = star_lifetime * r1 * pfactor;
			const scale = (star_scale * r2) / pfactor;

			const particle = new Particle(sprite, lifitime, scale);

			sprite.position.copy(pos);
			sprite.position.x += 0.5 * r3;
			sprite.position.y += 0.5 * r4;
			sprite.scale.set(0, 0, 0);
			particle.physics = physics;
			// todo: remake math. Calculate 180 angle instead
			particle.vx = Math.abs(r3) * 3e-2 * (dir.x || Math.sign(r3));
			particle.vy = Math.abs(r4) * 3e-2 * (dir.y || Math.sign(r4));
			particle.vx *= pfactor * strength;
			particle.vy *= pfactor * strength;

			this.particles_stars[id] = particle;
			this.scene_render.addObject(id, sprite);
		}
	}

	spawnStarParticle_02(pos: THREE.Vector3) {
		const star_lifetime = 1.2;
		const star_scale = 0.3;

		const amount = Math.random() * 4 + 4;

		for (let i = 0; i < amount; i++) {
			const sprite = this.sprite_dollar_ref.clone();
			const id = "i" + sprite.id;
			const rfactor = i / amount;

			// ~[0.05,1.95]
			const r1 = 1 - (Math.random() - 0.5) * 1.9;
			// [0.1, 1]
			const r2 = 1 - Math.random() * 0.9;
			// [-0.5,0.5]
			const r3 = (Math.random() - 0.5);
			const r4 = (Math.random() - 0.5);

			const lifitime = star_lifetime * r1;
			const scale = (star_scale * r2);

			const particle = new Particle(sprite, lifitime, scale);

			sprite.position.copy(pos);
			sprite.position.x += 0.5 * r3;
			sprite.position.y += 0.5 * r4;
			sprite.scale.set(0, 0, 0);
			particle.vx = r3 * 1e-3;
			particle.vy = 1e-3;

			this.particles_stars[id] = particle;
			this.scene_render.addObject(id, sprite);
		}
	}

	step(dt) {
		for (const k in this.particles_stars) {
			const p = this.particles_stars[k];
			const s = p.sprite;

			const anim_in_duration = p.lifitime * 0.4;
			const anim_out_duration = p.lifitime - anim_in_duration;
			if (p.elapsed <= anim_in_duration) {
				const f = p.elapsed / anim_in_duration;
				const v1 = easeBackOut(f, 3) * p.size;
				const v2 = easeBackOut(Math.max(1, f + 0.2), 1.2) * p.size;
				s.scale.set(v1, v2, 1);
			} else {
				const f = (p.elapsed - anim_in_duration) / anim_out_duration;
				const v = Math.pow(1 - f, 2) * p.size;
				s.scale.set(v, v, v);
			}

			let vx = p.vx;
			let vy = p.vy;
			if (p.physics) {
				const size = s.scale.y;
				const sizex = size * Math.sin(p.vx);
				const sizey = size * Math.sin(p.vy);
				vy = p.vy = p.vy - 1e-1 * dt;

				const x = s.position.x + sizex;
				const y = s.position.y + sizey;
				const collision = this.scene_collisions.testRay(
					x,
					y,
					x + p.vx,
					y + p.vy
				);

				if (collision.hit) {
					s.position.x = collision.point_x - sizex;
					s.position.y = collision.point_y - sizey;

					p.vx *= (collision.normal_x ? -1 : 1) * 0.7;
					p.vy *= (collision.normal_y ? -1 : 1) * 0.7;
					vx = p.vx;
					vy = p.vy;
				}
			} else {
				const f = p.elapsed / p.lifitime;
				const v = 1 - Math.pow(1 - f, 3);
				vx *= v;
				vy *= v;
			}
			s.position.x += vx;
			s.position.y += vy;

			p.elapsed += dt;
			if (p.elapsed > p.lifitime) {
				delete this.particles_stars[k];
				this.scene_render.removeObject(k);
			}
		}
	}
}
