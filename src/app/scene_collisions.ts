import { Vector2, Box2, Vector3 } from "../lib/three.module.js";

// https://github.com/tynrare/collisions-wasm
import CollisionsModule from "../lib/generated/collisions.js";

const UNITS_SCALE_MUL = 1e2;
const UNITS_SCALE_DIV = 1e-2;

enum ColliderType {
	RIGID = 0,
	SIGNAL = 1,
}

class BoxColliderC {
	/**
	 * @type {CollisionsModule.b2AABB}
	 */
	b2AABB: any;
	type: ColliderType;
	cache: any;

	constructor(aabb, type: ColliderType) {
		this.b2AABB = aabb;
		this.type = type;
		this.cache = {};
		this.discache();
	}

	discache() {
		this.cache.lbx = null;
		this.cache.lby = null;
		this.cache.ubx = null;
		this.cache.uby = null;
		this.cache.w = null;
		this.cache.h = null;
		this.cache.x = null;
		this.cache.y = null;
	}

	get _left(): number {
		if (this.cache.lbx === null) {
			this.cache.lbx = this.b2AABB.lowerBound.x * UNITS_SCALE_DIV;
		}
		return this.cache.lbx;
	}

	get _right(): number {
		if (this.cache.ubx === null) {
			this.cache.ubx = this.b2AABB.upperBound.x * UNITS_SCALE_DIV;
		}
		return this.cache.ubx;
	}

	get _bottom(): number {
		if (this.cache.lby === null) {
			this.cache.lby = this.b2AABB.lowerBound.y * UNITS_SCALE_DIV;
		}
		return this.cache.lby;
	}

	get _top(): number {
		if (this.cache.uby === null) {
			this.cache.uby = this.b2AABB.upperBound.y * UNITS_SCALE_DIV;
		}
		return this.cache.uby;
	}

	get width(): number {
		if (this.cache.w === null) {
			this.cache.w = this._right - this._left;
		}
		return this.cache.w;
	}

	get height(): number {
		if (this.cache.h === null) {
			this.cache.h = this._top - this._bottom;
		}
		return this.cache.h;
	}

	get x(): number {
		if (this.cache.x === null) {
			this.cache.x = this._left + this.width * 0.5;
		}
		return this.cache.x;
	}

	get y(): number {
		if (this.cache.y === null) {
			this.cache.y = this._bottom + this.height * 0.5;
		}
		return this.cache.y;
	}
}

interface DynamicBody {
	id: string;
	collider: BoxColliderC;

	/**
	 * units/second
	 */
	velocity_x: number;
	velocity_y: number;

	contacts: number;
	contacts_list: Array<CollisionResult>;
}

/**
 * Not all values always used. Quite a mess here
 */
interface CollisionResult {
	normal_x: number;
	normal_y: number;
	point_x: number;
	point_y: number;
	hit: boolean;
	time: number;
	id: string | null;
}

class CollidersCache {
	vec2_0: Vector2;
	vec2_1: Vector2;
	vec2_2: Vector2;
	bc_0: BoxColliderC;
	cr_0: CollisionResult;
	contacts: Array<CollisionResult>;
	constructor() {
		this.cr_0 = {
			point_x: 0,
			point_y: 0,
			hit: false,
			normal_x: 0,
			normal_y: 0,
			time: 0,
			id: null,
		};
		this.contacts = CollidersCache.constructContactsArray(8);
		this.vec2_0 = new Vector2();
		this.vec2_1 = new Vector2();
		this.vec2_2 = new Vector2();
	}

	static constructContactsArray(length: number): Array<CollisionResult> {
		return Array.apply(null, { length }).map(() => {
			return Object.assign({}, { normal_x: 0, normal_y: 0, time: 0 });
		});
	}
}

class SceneCollisions {
	/**
	 * @type {CollisionsModule.Collisions}
	 */
	core: any;
	colliders: { [id: string]: BoxColliderC };
	bodies: { [id: string]: DynamicBody };
	origin: Vector3;
	normal: Vector3;
	cache: CollidersCache;
	step_threshold: number;
	step_elapsed: number;
	last_step_elapsed: number;
	step_number: number;
	forces_scale: number;

	constructor() {
		this.colliders = {};
		this.bodies = {};
		this.origin = new Vector3();
		this.normal = new Vector3(0, 0, 1);

		this.forces_scale = 1.7;

		this.cache = new CollidersCache();

		this.step_threshold = 0.01;
		this.step_elapsed = 0;
		this.last_step_elapsed = 1;
		this.step_number = 0;
	}

	async init() {
		this.dispose();
		this.core = new (await CollisionsModule()).Collisions(1);
	}

	clear() {
		for (const k in this.bodies) {
			this.removeBody(k, true);
		}

		for (const k in this.colliders) {
			this.removeCollider(k);
		}
	}

	dispose() {
		this.clear();
		if (this.core) {
			delete this.core;
			this.core = null;
		}
	}

	step(dt: number) {
		this.step_elapsed += dt;

		if (this.step_elapsed <= this.step_threshold) {
			return;
		}

		this.last_step_elapsed = Math.min(
			this.step_threshold * 2,
			this.step_elapsed
		);

		for (const k in this.bodies) {
			this.stepBody(this.bodies[k], this.last_step_elapsed);
		}

		this.step_number += 1;
		this.step_elapsed = 0;
	}

	stepBody(body: DynamicBody, dt: number) {
		dt *= this.forces_scale;

		if (!body.collider) {
			console.warn(`body ${body.id} without collider. removing it.`);
			this.removeBody(body.id, false);
			return;
		}

		const newpos = this.core.test(
			body.collider.b2AABB,
			(body.collider.x + body.velocity_x * dt) * UNITS_SCALE_MUL,
			(body.collider.y + body.velocity_y * dt) * UNITS_SCALE_MUL
		);

		this.core.b2AABB_setPos(body.collider.b2AABB, newpos.x, newpos.y);
		body.collider.discache();

		body.contacts = 0;
		for (const k in this.colliders) {
			const collider = this.colliders[k];
			const contact = this.cache.cr_0;
			if (this.detailedAABBCollision(body.collider, collider, contact)) {
				const c = body.contacts_list[body.contacts];
				if (!c) {
					break;
				}
				if (collider.type == ColliderType.RIGID) {
					c.normal_x = contact.normal_x;
					c.normal_y = contact.normal_y;
					c.time = contact.time;
				} else {
					c.normal_x = c.normal_y = 0;
					c.time = 1;
				}
				c.id = k;
				body.contacts += 1;
			}
		}

		// discard velocities
		for (let i = 0; i < body.contacts; i++) {
			const c = body.contacts_list[i];
			if (c.normal_x && c.time < 1) {
				body.velocity_x = 0;
			}
			if (c.normal_y && c.time < 1) {
				body.velocity_y = 0;
			}
		}
	}

	createBoxColliderByPos(
		id: string,
		x: number,
		y: number,
		width: number,
		height: number,
		type: ColliderType = ColliderType.RIGID
	): BoxColliderC {
		//const aabb = this.core.addAABB(id, x, y, w, h);
		const sx = x * UNITS_SCALE_MUL;
		const sy = y * UNITS_SCALE_MUL;
		const sw = width * UNITS_SCALE_MUL;
		const sh = height * UNITS_SCALE_MUL;
		let aabb;
		if (type == ColliderType.RIGID) {
			aabb = this.core.addAABB(id, sx, sy, sw, sh);
		} else {
			aabb = this.core.b2AABB_ConstructFromCenterSizeP(sx, sy, sw, sh);
		}
		const boxc = new BoxColliderC(aabb, type);

		this.colliders[id] = boxc;

		return boxc;
	}

	createBoxCollider(
		id: string,
		box: Box2,
		type: ColliderType = ColliderType.RIGID
	): BoxColliderC {
		const w = box.max.x - box.min.x;
		const h = box.max.y - box.min.y;
		const x = box.min.x + w / 2;
		const y = box.min.y + h / 2;
		return this.createBoxColliderByPos(id, x, y, w, h, type);
	}

	createBoxBody(id, box: Box2): DynamicBody {
		const collider = this.createBoxCollider(id, box);

		return this.addBoxBody(id, collider);
	}

	addBoxBody(id: string, collider: BoxColliderC): DynamicBody {
		if (!collider) {
			throw new Error(
				"SceneCollisions::addBoxBody error - no collider provided"
			);
		}
		const body = {
			id,
			collider,
			velocity_x: 0,
			velocity_y: 0,
			contacts: 0,
			contacts_list: CollidersCache.constructContactsArray(4),
		};
		this.bodies[id] = body;

		return body;
	}

	removeBody(id: string, with_collider: boolean = true) {
		if (!this.bodies[id]) {
			return;
		}
		delete this.bodies[id];

		if (with_collider) {
			this.removeCollider(id);
		}
	}

	removeCollider(id: string) {
		if (this.colliders[id]) {
			if (!this.core.eraseAABB(id)) {
				this.core.freeP(this.colliders[id].b2AABB);
			}
			delete this.colliders[id];
		}
	}

	setColliderPos(collider: BoxColliderC, x: number, y: number) {
		this.core.b2AABB_setPos(
			collider.b2AABB,
			x * UNITS_SCALE_MUL,
			y * UNITS_SCALE_MUL
		);
		collider.discache();
	}

	testRay(ox: number, oy: number, tx: number, ty: number): CollisionResult {
		const c = this.cache.cr_0;
		c.hit = false;
		const rc = this.core.testRay(
			ox * UNITS_SCALE_MUL,
			oy * UNITS_SCALE_MUL,
			tx * UNITS_SCALE_MUL,
			ty * UNITS_SCALE_MUL
		);

		if (rc.hit) {
			c.hit = rc.hit;
			c.point_x = rc.point.x * UNITS_SCALE_DIV;
			c.point_y = rc.point.y * UNITS_SCALE_DIV;
			c.normal_x = rc.normal.x;
			c.normal_y = rc.normal.y;
			c.time = rc.fraction;
		}

		return c;
	}

	detailedAABBCollision(
		a: BoxColliderC,
		b: BoxColliderC,
		ret: CollisionResult
	): boolean {
		ret.normal_x = 0;
		ret.normal_y = 0;
		ret.time = 1;

		if (a == b) {
			return false;
		}

		const d1x = b._left - a._right;
		const d1y = b._bottom - a._top;
		const d2x = a._left - b._right;
		const d2y = a._bottom - b._top;

		if (d1x > 0.0 || d1y > 0.0) return false;

		if (d2x > 0.0 || d2y > 0.0) return false;

		const x = -Math.max(d1x, d2x);
		const y = -Math.max(d1y, d2y);
		const normal_y = d1y > d2y ? 1 : -1;
		const normal_x = d1x > d2x ? 1 : -1;

		if (x < y) {
			ret.normal_x = normal_x;
			ret.time = -x;
		} else {
			ret.normal_y = normal_y;
			ret.time = -y;
		}

		return true;
	}

	simpleAABBCollision(a: BoxColliderC, b: BoxColliderC) {
		// should test by id
		if (a == b) {
			return false;
		}

		return (
			a._left <= b._right &&
			a._right >= b._left &&
			a._top >= b._bottom &&
			a._bottom <= b._top
		);
	}

	thresholdAABBCollision(a: BoxColliderC, b: BoxColliderC, threshold_x: number, threshold_y: number = threshold_x) {
		// should test by id
		if (a == b) {
			return false;
		}

		const tx = -threshold_x;
		const ty = -threshold_y;

		return (
			a._right - b._left > tx &&
			b._right - a._left > tx &&
			a._top - b._bottom > ty &&
			b._top - a._bottom > ty
		);
	}
}

export default SceneCollisions;
export { SceneCollisions, BoxColliderC, DynamicBody, ColliderType };
