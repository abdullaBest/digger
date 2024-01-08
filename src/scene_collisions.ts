import { Vector2, Box2, Vector3 } from "./lib/three.module";

// https://github.com/tynrare/collisions-wasm
import CollisionsModule from "./lib/generated/collisions.js";

const UNITS_SCALE_MUL = 1e2;
const UNITS_SCALE_DIV = 1e-2;

enum ColliderType {
    RIGID = 0,
    SIGNAL = 1
}

class BoxColliderC {
    /**
     * @type {CollisionsModule.b2AABB}
     */
    b2AABB: any;
    type: ColliderType;

    constructor(aabb, type: ColliderType) {
        this.b2AABB = aabb;
        this.type = type;
    }

    get _left(): number {
        return this.b2AABB.lowerBound.x * UNITS_SCALE_DIV;
    }

    get _right(): number {
        return this.b2AABB.upperBound.x * UNITS_SCALE_DIV;
    }

    get _bottom(): number {
        return this.b2AABB.lowerBound.y * UNITS_SCALE_DIV;
    }

    get _top(): number {
        return this.b2AABB.upperBound.y * UNITS_SCALE_DIV;
    }

    get width(): number {
        return this._right - this._left;
    }

    get height(): number {
        return this._right - this._left;
    }

    get x(): number {
        return this._left + this.width / 2;
    }

    get y(): number {
        return this._bottom + this.height / 2;
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

interface CollisionResult {
    normal_x: number;
    normal_y: number;
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
        this.cr_0 = { normal_x: 0, normal_y: 0, time: 0, id: null };
        this.contacts = CollidersCache.constructContactsArray(8);
        this.vec2_0 = new Vector2();
        this.vec2_1 = new Vector2();
        this.vec2_2 = new Vector2();
    }

    static constructContactsArray(length: number): Array<CollisionResult> {
        return Array.apply(null,{ length }).map(() => { return Object.assign({}, { normal_x: 0, normal_y: 0, time: 0,  }) });
    }
}

class SceneCollisions {
    /**
     * @type {CollisionsModule.Collisions}
     */
    core: any;
    colliders: { [id: string] : BoxColliderC; };
    bodies: { [id: string] : DynamicBody; };
    origin: Vector3;
    normal: Vector3;
    gravity: Vector2;
    cache: CollidersCache;
    step_threshold: number;
    step_elapsed: number;
    step_number: number;
    forces_scale: number;

    constructor() {
        this.colliders = {};
        this.bodies = {};
        this.origin = new Vector3();
        this.normal = new Vector3(0, 0, 1);
        
        this.gravity = new Vector2(0, -9.8);
        this.forces_scale = 1.7;

        this.cache = new CollidersCache();

        this.step_threshold = 0.05;
        this.step_elapsed = 0;
        this.step_number = 0;
    }

    async init() {
        this.dispose();
        this.core = new (await CollisionsModule()).Collisions(1);
    }

    clear() {
        for(const k in this.bodies) {
            this.removeBody(k, true);
        }

        for(const k in this.colliders) {
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

        for(const k in this.bodies) {
            this.stepBody(this.bodies[k], Math.min(this.step_threshold, this.step_elapsed));
        }

        this.step_number += 1;
        this.step_elapsed = 0;
    }

    stepBody(body: DynamicBody, dt: number) {
        dt *= this.forces_scale;
        body.velocity_y += this.gravity.y * dt;

        if (!body.collider) {
            console.warn(`body ${body.id} without collider. removing it.`)

        }

        const newpos = this.core.test(
            body.collider.b2AABB, 
            (body.collider.x + body.velocity_x * dt) * UNITS_SCALE_MUL, 
            (body.collider.y + body.velocity_y * dt) * UNITS_SCALE_MUL);

        this.core.b2AABB_setPos(body.collider.b2AABB, newpos.x, newpos.y);

        body.contacts = 0;
        for (const k in this.colliders) {
            if(this.detailedAABBCollision(body.collider, this.colliders[k], this.cache.cr_0)) {
                const c = body.contacts_list[body.contacts];
                if (!c) {
                    break;
                }
                c.normal_x = this.cache.cr_0.normal_x;
                c.normal_y = this.cache.cr_0.normal_y;
                c.time = this.cache.cr_0.time;
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

    createBoxCollider(id: string, box: Box2, type: ColliderType = ColliderType.RIGID) : BoxColliderC {
        const w = (box.max.x - box.min.x) * UNITS_SCALE_MUL;
        const h = (box.max.y - box.min.y) * UNITS_SCALE_MUL;
        const x = box.min.x * UNITS_SCALE_MUL + w / 2;
        const y = box.min.y * UNITS_SCALE_MUL + h / 2;

        //const aabb = this.core.addAABB(id, x, y, w, h);
        let aabb;
        if (type == ColliderType.RIGID) {
            aabb = this.core.addAABB(id, x, y, w, h);
        } else {
            aabb = this.core.b2AABB_ConstructFromCenterSizeP(x, y, w, h);
        }
        const boxc = new BoxColliderC(aabb, type);

        this.colliders[id] = boxc;

        return boxc;
    }

    createBoxBody(id, box: Box2) : DynamicBody {
        const collider = this.createBoxCollider(id, box);

        return this.addBoxBody(id, collider);
    }

    addBoxBody(id: string, collider: BoxColliderC) : DynamicBody {
        const body = {
            id,
            collider,
            velocity_x: 0,
            velocity_y: 0,
            contacts: 0,
            contacts_list: CollidersCache.constructContactsArray(4)
        }
        this.bodies[id] = body;

        return body;
    }

    removeBody(id: string, with_collider: boolean) {
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
            if(!this.core.eraseAABB(id)) {
                this.core.freeP(this.colliders[id].b2AABB);
            }
            delete this.colliders[id];
        }
    }

    setColliderPos(collider: BoxColliderC, x: number, y: number) {
        this.core.b2AABB_setPos(collider.b2AABB, x * UNITS_SCALE_MUL, y * UNITS_SCALE_MUL);
    }


    detailedAABBCollision(a: BoxColliderC, b: BoxColliderC, ret: CollisionResult): boolean {
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

        if (d1x > 0.0 || d1y > 0.0)
            return false;

        if (d2x > 0.0 || d2y > 0.0)
            return false;

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
        
        return a._left <= b._right &&
                a._right >= b._left &&
                a._top >= b._bottom &&
                a._bottom <= b._top;
    }
}

export default SceneCollisions;
export { SceneCollisions, BoxColliderC, DynamicBody, ColliderType }