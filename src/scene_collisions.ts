import { Vector2, Box2, Vector3 } from "./lib/three.module";

enum ColliderType {
    RIGID = 0,
    SIGNAL = 1
}

interface BoxCollider {
    width: number;
    height: number;
    
    pos_x: number;
    pos_y: number;

    type: ColliderType;

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

    contacts: number;
    contacts_list: Array<CollisionResult>;
}

interface CollisionResult {
    normal_x: number;
    normal_y: number;
    time: number;
}

class CollidersCache {
    vec2_0: Vector2;
    vec2_1: Vector2;
    vec2_2: Vector2;
    bc_0: BoxCollider;
    cr_0: CollisionResult;
    contacts: Array<CollisionResult>;
    constructor() {
        this.bc_0 = SceneCollisions.makeBoxCollider();
        this.cr_0 = { normal_x: 0, normal_y: 0, time: 0,  };
        this.contacts = Array.apply(null,{length: 8}).map(() => { return Object.assign({}, this.cr_0) });
        this.vec2_0 = new Vector2();
        this.vec2_1 = new Vector2();
        this.vec2_2 = new Vector2();
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
            velocity_y: 0,
            contacts: 0,
            contacts_list: this.cache.contacts
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
            this.stepBody(this.bodies[k], Math.min(this.step_threshold, this.step_elapsed));
        }

        this.step_number += 1;
        this.step_elapsed = 0;
    }

    stepBody(body: DynamicBody, dt: number) {
        dt *= this.forces_scale;
        body.velocity_y += this.gravity.y * dt;

        let colliders_list: Array<BoxCollider> = [];
        body.contacts = 0;
        const applySwept = (collider) => {
            const collision = this.cache.cr_0;
            if (this.sweptAABB(body, collider, collision, dt)) {
                body.velocity_x -= collision.normal_x * Math.abs(body.velocity_x) * (1 - collision.time)
                body.velocity_y -= collision.normal_y * Math.abs(body.velocity_y) * (1 - collision.time)

                const c = body.contacts_list[body.contacts++];
                c.normal_x = collision.normal_x;
                c.normal_y = collision.normal_y;
                c.time = collision.time;
            } 
            if (this.testAABB(body.collider, collider, collision)) {
            // second collision test: pushes out bounding box and registers zero-time collisions
                const cx = collision.normal_x && (collision.normal_x == Math.sign(body.velocity_x) || !body.velocity_x);
                const cy = collision.normal_y && (collision.normal_y == Math.sign(body.velocity_y) || !body.velocity_y);
                if (!cx && !cy) {
                    return;
                }

                // a. corner detection. push out body from corner
                if (Math.abs(collision.normal_x) + Math.abs(collision.normal_y) < 0.1) {
                    body.velocity_x -= collision.normal_x / dt;
                    body.velocity_y -= collision.normal_y / dt;
                }

                /*
                if (cx) {
                    body.velocity_x = collision.normal_x * collision.time / dt;
                } else if (cy) {
                    body.velocity_y = collision.normal_y * collision.time / dt;
                }
                */

                const c = body.contacts_list[body.contacts++];
                c.normal_y = collision.normal_y;
                c.normal_x = collision.normal_x;
                c.time = collision.time;
            }
        }

        let broadphasebox = this.calcBodyBroadphase(body, dt); 
        for(const k in this.colliders) {
            const collider = this.colliders[k];
            if (this.testCollisionAabb(broadphasebox, collider)) {
                colliders_list.push(collider);
            }
        }

        colliders_list.sort((a, b) => {
            const adx = a.pos_x - body.collider.pos_x;
            const ady = a.pos_y - body.collider.pos_y;
            const bdx = b.pos_x - body.collider.pos_x;
            const bdy = b.pos_y - body.collider.pos_y;
            const la = Math.sqrt(adx * adx + ady * ady);
            const lb = Math.sqrt(bdx * bdx + bdy * bdy);

            return la - lb;
        })

        while(colliders_list.length) {
            applySwept(colliders_list.shift());
        }

        const vx = body.velocity_x * dt;
        const vy = body.velocity_y * dt;
        let newx = body.collider.pos_x + vx;
        let newy = body.collider.pos_y + vy;
        SceneCollisions.setColliderPos(body.collider, newx, newy);

        // discard velocities
        // it nod gonna be affected by testAABB in applySwept cause testAABB do not use time
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

    getBodyNextShift(body: DynamicBody, vec: Vector2) {
        const dt = this.forces_scale * this.step_threshold;
        const posx = body.velocity_x * dt;
        const posy = body.velocity_y * dt;
        
        return vec.set(posx, posy);
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
    calcBodyBroadphase(body: DynamicBody, dt: number, threshold: number = 0) : BoxCollider {
        const vx = body.velocity_x * dt;
        const vy = body.velocity_y * dt;
        let bbox = this.cache.bc_0;
        bbox._left = Math.min(body.collider._left, body.collider._left + vx) - threshold;
        bbox._bottom = Math.min(body.collider._bottom, body.collider._bottom + vy) - threshold;
        bbox._right = Math.max(body.collider._right, body.collider._right + vx) + threshold;
        bbox._top = Math.max(body.collider._top, body.collider._top + vy) + threshold;
      
        return bbox; 
    }

    // https://gdbooks.gitbooks.io/3dcollisions/content/Chapter3/raycast_aabb.html
    /**
     * 
     * @param ray_origin 
     * @param ray_dir 
     * @param collider 
     * @param ret 
     * @returns Infinity or NaN possible. Be aware
     */
    testRayRect(ray_origin: Vector2, ray_dir: Vector2, collider: BoxCollider, ret: CollisionResult = ({} as any)) : boolean {
        // In could produce Infinity if ray_dir equals zero wich is ok
        // It could produce evenn NaN if collider._edge == ray_origin wich seems to be ok too

        const min_x = (collider._left - ray_origin.x) / ray_dir.x;
        const max_x = (collider._right - ray_origin.x) / ray_dir.x;
        const near_x = Math.min(min_x, max_x);
        const far_x = Math.max(min_x, max_x);

        const min_y = (collider._bottom - ray_origin.y) / ray_dir.y;
        const max_y = (collider._top - ray_origin.y) / ray_dir.y;
        const near_y = Math.min(min_y, max_y);
        const far_y = Math.max(min_y, max_y);

        const tmin = Math.max(near_x, near_y);
        const tmax = Math.min(far_x, far_y);
    
        ret.time = 1;
        ret.normal_x = 0;
        ret.normal_y = 0;

        // if tmax < 0, ray (line) is intersecting AABB, but whole AABB is behing us
        if (tmax < 0) {
            return false;
        }

        // if tmin > 1 intersection far away from segment
        if (tmin >= 1) {
            return false;
        }

        // if tmin > tmax, ray doesn't intersect AABB
        if (tmin > tmax) {
            return false;
        }
    
        /*
        if (tmin < 0) {
            ret.time = tmax; // ?
        }
        */

        ret.time = tmin;

        if (near_x > near_y) {
            ret.normal_x = Math.sign(ray_dir.x);
        } else /*if (near_x < near_y)*/ {
            ret.normal_y = Math.sign(ray_dir.y);
        } /*else {
            // Both axes now have equal intersection depth (direct and perfect corner collision).
        }*/

        return true;
    }

    /**
     * does not use ret time. instead writes collision depth into nornal_x normal_y
     */
    testAABB(a: BoxCollider, b: BoxCollider, ret: CollisionResult = ({} as any)) : boolean {
        ret.time = 1;
        ret.normal_x = 0;
        ret.normal_y = 0;

        const dx = a.pos_x - b.pos_x;
        const px = Math.abs(dx) - a.width / 2 - b.width / 2;
        if (px > 0) {
            return false;
        }

        const dy = a.pos_y - b.pos_y;
        const py = Math.abs(dy) - a.height / 2 - b.height / 2;
        if (py > 0) {
            return false;
        }

        ret.normal_x = px * Math.sign(dx);
        ret.normal_y = py * Math.sign(dy);

        return true;
    }

    sweptAABB(a: DynamicBody, b: BoxCollider, ret: CollisionResult = ({} as any), dt: number): boolean {
        const vx = a.velocity_x * dt;
        const vy = a.velocity_y * dt;

        const apos = this.cache.vec2_0.set(a.collider.pos_x, a.collider.pos_y);
        const adir = this.cache.vec2_1.set(vx, vy);
        const extended_box = this.cache.bc_0;
        extended_box.width = b.width + a.collider.width;
        extended_box.height = b.height + a.collider.height;
        SceneCollisions.setColliderPos(extended_box, b.pos_x, b.pos_y);

        return this.testRayRect(apos, adir, extended_box, ret) && ret.time >= 0 && ret.time < 1 && !!(ret.normal_x || ret.normal_y);
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

    static makeBoxCollider(box?: Box2, type: ColliderType = ColliderType.RIGID) : BoxCollider {
        const collider = {
            width: 0,
            height: 0,
            pos_x: 0,
            pos_y: 0,
            _left: 0,
            _top: 0,
            _right: 0,
            _bottom: 0,
            type
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