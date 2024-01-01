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
        this.forces_scale = 1.5;

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
        body.velocity_y += this.gravity.y * dt / 1000;

        let colliders_list: Array<BoxCollider> = [];
        body.contacts = 0;
        const applySwept = (collider) => {
            const collision = this.cache.cr_0;
            if (this.sweptAABB(body, collider, this.cache.cr_0, dt)) {
                body.velocity_x -= collision.normal_x * Math.abs(body.velocity_x) * (1 - collision.time)
                body.velocity_y -= collision.normal_y * Math.abs(body.velocity_y) * (1 - collision.time)

                const c = body.contacts_list[body.contacts++];
                c.normal_x = collision.normal_x;
                c.normal_y = collision.normal_y;
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

        const vx = body.velocity_x * dt / 1000;
        const vy = body.velocity_y * dt / 1000;
        let newx = body.collider.pos_x + vx;
        let newy = body.collider.pos_y + vy;
        SceneCollisions.setColliderPos(body.collider, newx, newy);

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

    getBodyNextShift(body: DynamicBody, vec: Vector2) {
        const dt = this.forces_scale * this.step_threshold  / 1000;
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
    calcBodyBroadphase(body: DynamicBody, dt: number, threshold: number = 0.1) : BoxCollider {
        const vx = body.velocity_x * dt / 1000;
        const vy = body.velocity_y * dt / 1000;
        let bbox = this.cache.bc_0;
        bbox._left = Math.min(body.collider._left, body.collider._left + vx) - threshold;
        bbox._bottom = Math.min(body.collider._bottom, body.collider._bottom + vy) - threshold;
        bbox._right = Math.max(body.collider._right, body.collider._right + vx) + threshold;
        bbox._top = Math.max(body.collider._top, body.collider._top + vy) + threshold;
      
        return bbox; 
    }

    // https://github.com/OneLoneCoder/Javidx9/blob/master/PixelGameEngine/SmallerProjects/OneLoneCoder_PGE_Rectangles.cpp#L78
    testRayRect(ray_origin: Vector2, ray_dir: Vector2, collider: BoxCollider, ret: CollisionResult = ({} as any)) : boolean {
        ret.normal_x = 0;
        ret.normal_y = 0;
        ret.time = 1;

        // Cache division
        const invdir_x = 1.0 / ray_dir.x;
        const invdir_y = 1.0 / ray_dir.y;
        let t_near_x = -invdir_x;
        let t_far_x = invdir_x;
        let t_near_y = -invdir_y;
        let t_far_y = invdir_y;
        // Calculate intersections with rectangle bounding axes
        //if (Number.isFinite(invdir_x)) {
            t_near_x = (collider._left - ray_origin.x) * invdir_x;
            t_far_x = (collider._right - ray_origin.x) * invdir_x;
        //}
        //if (Number.isFinite(invdir_y)) {
            t_near_y = (collider._top - ray_origin.y) * invdir_y;
            t_far_y = (collider._bottom - ray_origin.y) * invdir_y;
        //}

        if (Number.isNaN(t_far_y) || Number.isNaN(t_far_x)) return false;
        if (Number.isNaN(t_near_y) || Number.isNaN(t_near_x)) return false;

        // Sort distances
        if (t_near_x > t_far_x) { 
            const tmp = t_near_x;
            t_near_x = t_far_x;
            t_far_x = tmp;
        }

        if (t_near_y > t_far_y) {
            const tmp = t_near_y;
            t_near_y = t_far_y;
            t_far_y = tmp;
        };

        // Early rejection		
        if (t_near_x >= t_far_y || t_near_y > t_far_x) {
            return false;
        }

        // Closest 'time' will be the first contact
        const t_hit_near = Math.max(t_near_x, t_near_y);

        // Furthest 'time' is contact on opposite side of target
        const t_hit_far = Math.min(t_far_x, t_far_y);

        // Reject if ray direction is pointing away from object
        if (t_hit_far < 0) {
            return false;
        }

        ret.time = t_hit_near;

        // Contact point of collision from parametric line equation
        //contact_point_x = ray_origin + t_hit_near * ray_dir;

        if (t_near_x > t_near_y) {
            ret.normal_x = Math.sign(invdir_x);
        } else if (t_near_x < t_near_y) {
            ret.normal_y = Math.sign(invdir_y);
        }

        // Note if t_near == t_far, collision is principly in a diagonal
        // so pointless to resolve. By returning a CN={0,0} even though its
        // considered a hit, the resolver wont change anything.
        return true;
    }

    sweptAABB(a: DynamicBody, b: BoxCollider, ret: CollisionResult = ({} as any), dt: number): boolean {
        const vx = a.velocity_x * dt / 1000;
        const vy = a.velocity_y * dt / 1000;

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