import { Vector2, Box2, Vector3 } from "./lib/three.module";

interface BoxCollider {
    width: number;
    height: number;
    
    pos_x: number;
    pos_y: number;

    _left: number;
    _top: number;
    _right: number;
    _bottom: number;
}

interface DynamicBody {
    id: string;
    collider: BoxCollider;

    /**
     * units/second
     */
    velocity_x: number;
    velocity_y: number;
}

interface CollisionResult {
    normal_x: number;
    normal_y: number;
    time_x: number;
    time_y: number;
}

class CollidersCache {
    bc_0: BoxCollider;
    cr_0: CollisionResult;
    contacts: Array<CollisionResult>;
    constructor() {
        this.bc_0 = SceneCollisions.makeBoxCollider();
        this.cr_0 = { normal_x: 0, normal_y: 0, time_x: 0, time_y: 0 };
        this.contacts = Array.apply(null,{length: 8}).map(() => { return Object.assign({}, this.cr_0) });
    }
}

class SceneCollisions {
    colliders: { [id: string] : BoxCollider; };
    bodies: { [id: string] : DynamicBody; };
    origin: Vector3;
    normal: Vector3;
    gravity: Vector2;
    cache: CollidersCache;
    step_threshold: number;
    step_elapsed: number;
    step_number: number;

    constructor() {
        this.colliders = {};
        this.bodies = {};
        this.origin = new Vector3();
        this.normal = new Vector3(0, 0, 1);
        this.gravity = new Vector2(0, -9.8);
        this.cache = new CollidersCache();

        this.step_threshold = 100;
        this.step_elapsed = 0;
        this.step_number = 0;
    }

    addBoxCollider(id: string, box: Box2) : BoxCollider {
        const collider = SceneCollisions.makeBoxCollider(box);
        this.colliders[id] = collider;

        return collider;
    }

    addBoxBody(id, box: Box2) : DynamicBody {
        const collider = SceneCollisions.makeBoxCollider(box);
        const body = {
            id,
            collider,
            velocity_x: 0,
            velocity_y: 0
        }
        this.bodies[id] = body;

        return body;
    }

    removeBody(id: string) {
        delete this.bodies[id];
    }

    removeCollider(id: string) {
        delete this.colliders[id];
    }

    remove(id: string) {
        delete this.colliders[id];
    }

    step(dt: number) {
        this.step_elapsed += dt;

        if (this.step_elapsed <= this.step_threshold) {
            return;
        }

        for(const k in this.bodies) {
            this.stepBody(this.bodies[k], Math.min(this.step_threshold * 2, this.step_elapsed));
        }

        this.step_number += 1;
        this.step_elapsed = 0;
    }

    stepBody(body: DynamicBody, dt: number) {
        body.velocity_y += this.gravity.y * dt / 1000;

        let collisions = 0;

        for(const k in this.colliders) {
            const collider = this.colliders[k];
            let broadphasebox = this.calcBodyBroadphase(body); 	
            //if (this.testCollisionAabb(broadphasebox, collider)) {
            const collision = this.sweptAABB(body, collider, this.cache.cr_0, dt);
            if (collision.time_x < 1 || collision.time_y < 1) {
                const c = this.cache.contacts[collisions++];
                c.time_x = collision.time_x;
                c.time_y = collision.time_y;
                c.normal_x = collision.normal_x;
                c.normal_y = collision.normal_y;
            }
        }

        let collision_time_x = 1;
        let collision_time_y = 1;
        for (let i = 0; i < collisions; i++) {
            const c = this.cache.contacts[i];
            collision_time_x = c.normal_x ? Math.min(collision_time_x, c.time_x) : collision_time_x;
            collision_time_y = c.normal_y ? Math.min(collision_time_y, c.time_y) : collision_time_y;
        }
        let newx = body.collider.pos_x + body.velocity_x * collision_time_x * dt / 1000;
        let newy = body.collider.pos_y + body.velocity_y * collision_time_y * dt / 1000;
        SceneCollisions.setColliderPos(body.collider, newx, newy);
        if (collision_time_x < 1e-4) {
            body.velocity_x = 0;
        }
        if (collision_time_y < 1e-4) {
            body.velocity_y = 0;
        } 
        if (collision_time_x || collision_time_y < 1)
        { 
            // ...
        }
    }

    testCollisionAabb(a: BoxCollider, b: BoxCollider) {
        return a._left <= b._right &&
                a._right >= b._left &&
                a._top >= b._bottom &&
                a._bottom <= b._top;
    }

    /**
     * @param body .
     * @returns cached BoxCollider
     */
    calcBodyBroadphase(body: DynamicBody) : BoxCollider {
        let bbox = this.cache.bc_0;
        bbox._left = body.collider._left + Math.max(0, body.velocity_x);
        bbox._bottom = body.collider._bottom + Math.min(0, body.velocity_y);
        bbox._right = body.collider._right + Math.min(0, body.velocity_x);
        bbox._top = body.collider._top + Math.max(0, body.velocity_y);
      
        return bbox; 
    }

    sweptAABB(a: DynamicBody, b: BoxCollider, ret: CollisionResult = ({} as any), dt: number): CollisionResult {
        const vx = a.velocity_x * dt / 1000;
        const vy = a.velocity_y * dt / 1000;

        const distDirX = Math.sign( b.pos_x - a.collider.pos_x );
        const distDirY = Math.sign( b.pos_y - a.collider.pos_y );
        // it isn't actually gonna be swept i guess but whatev. fix later (someday yeah)
        const deltaDistX = Math.abs(a.collider.pos_x - b.pos_x) - a.collider.width / 2 - b.width / 2; 
        const deltaDistY = Math.abs(a.collider.pos_y - b.pos_y) - a.collider.height / 2 - b.height / 2;

        ret.normal_x = 0;
        ret.normal_y = 0;
        ret.time_x = 1;
        //dunno use both times at same time but have feeling that i gonna need it later
        ret.time_y = 1;

        const distAfterMoveX = deltaDistX - Math.abs(vx);
        const distAfterMoveY = deltaDistY - Math.abs(vy);
        // means that boxes not jonna collide at all
        if (distAfterMoveX > 0 || distAfterMoveY > 0) {
            return ret;
        }

        const approaching_x = vx && Math.sign(vx) == distDirX;
        const approaching_y = vy && Math.sign(vy) == distDirY;
        ret.time_x = (approaching_x && vx) ? deltaDistX / Math.abs(vx) : 1;
        ret.time_y = (approaching_y && vy) ? deltaDistY / Math.abs(vy) : 1;

        // means that we are certain about axis we have to choose
        // deltaDistX < 0 means that it's iside X axis bounds
        const oneAxisBoundsAlready = deltaDistX < 0 || deltaDistY < 0;

        if (
            // a. it's inside X bounds so it can't collide on X axis
            (oneAxisBoundsAlready && deltaDistX > deltaDistY) ||
            // b. it's approaching from somewhere so using axis that peretrates deeper
            (!oneAxisBoundsAlready && distAfterMoveY < distAfterMoveX) // not sure about this check
            ) {
            // X collisions
            ret.normal_x = ret.time_x < 1 ? distDirX : 0;
        } else {
             // Y collisions
             ret.normal_y = ret.time_y < 1 ? distDirY : 0;
        }

        return ret;
    }

    static setColliderPos(collider: BoxCollider, x: number, y: number) {
        collider.pos_x = x;
        collider.pos_y = y;
        const half_width = collider.width / 2;
        const half_hieght = collider.height / 2;
        collider._left = x - half_width;
        collider._right = x + half_width;
        collider._bottom = y - half_hieght;
        collider._top = y + half_hieght;
    }

    static makeBoxCollider(box?: Box2) : BoxCollider {
        const collider = {
            width: 0,
            height: 0,
            pos_x: 0,
            pos_y: 0,
            _left: 0,
            _top: 0,
            _right: 0,
            _bottom: 0
        }

        if (box) {
            collider.width = box.max.x - box.min.x;
            collider.height = box.max.y - box.min.y;
            SceneCollisions.setColliderPos(collider, (box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2);
        }

        return collider;
    }
}

export default SceneCollisions;
export { SceneCollisions, BoxCollider, DynamicBody }