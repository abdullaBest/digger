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
    time: number;
    time_x: number;
    time_y: number;
}

class CollidersCache {
    bc_0: BoxCollider;
    cr_0: CollisionResult;
    cr_1: CollisionResult;
    cr_2: CollisionResult;
    constructor() {
        this.bc_0 = SceneCollisions.makeBoxCollider();
        this.cr_0 = { normal_x: 0, normal_y: 0, time: 0, time_x: 0, time_y: 0 };
        this.cr_1 = { normal_x: 0, normal_y: 0, time: 0, time_x: 0, time_y: 0};
        this.cr_2 = { normal_x: 0, normal_y: 0, time: 0, time_x: 0, time_y: 0 };
    }
}

class SceneCollisions {
    colliders: { [id: string] : BoxCollider; };
    bodies: { [id: string] : DynamicBody; };
    origin: Vector3;
    normal: Vector3;
    gravity: Vector2;
    cache: CollidersCache;

    constructor() {
        this.colliders = {};
        this.bodies = {};
        this.origin = new Vector3();
        this.normal = new Vector3(0, 0, 1);
        this.gravity = new Vector2(0, -0.01);
        this.cache = new CollidersCache();
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
        for(const k in this.bodies) {
            this.stepBody(this.bodies[k], dt);
        }
    }

    stepBody(body: DynamicBody, dt: number) {
        body.velocity_y += this.gravity.y;

        const closest_collision = this.cache.cr_1;
        closest_collision.time = 1;
        closest_collision.normal_x = 0;
        closest_collision.normal_y = 0;

        for(const k in this.colliders) {
            const collider = this.colliders[k];
            let broadphasebox = this.calcBodyBroadphase(body); 	
            if (false || this.testCollisionAabb(broadphasebox, collider)) 	
            { 
                const collision = this.sweptAABB(body, collider, this.cache.cr_0);
                if(collision.time < closest_collision.time) {
                    closest_collision.time = collision.time;
                    closest_collision.normal_x = collision.normal_x;
                    closest_collision.normal_y = collision.normal_y;
                }
            }
        }

        let collision_time_x = closest_collision.normal_x ? closest_collision.time : 1;
        let collision_time_y = closest_collision.normal_y ? closest_collision.time : 1;
        let newx = body.collider.pos_x + body.velocity_x * collision_time_x;
        let newy = body.collider.pos_y + body.velocity_y * collision_time_y;
        SceneCollisions.setColliderPos(body.collider, newx, newy);
        if (closest_collision.time < 1e-4) {
            body.velocity_x = body.velocity_x * (1- closest_collision.normal_x);
            body.velocity_y = body.velocity_y * (1- closest_collision.normal_y);
        }
        if (closest_collision.time < 1)
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

    sweptAABB(a: DynamicBody, b: BoxCollider, ret: CollisionResult = ({} as any)): CollisionResult {
        let xInvEntry = 0 , yInvEntry = 0; 
        let xInvExit = 0, yInvExit = 0; 

        // find the distance between the objects on the near and far sides for both x and y 
        const ax = b._left - a.collider._right;
        const bx = b._right - a.collider._left;
        const is_x_neg = a.velocity_x < 0;
        xInvEntry = is_x_neg ? bx : ax;
        xInvExit = is_x_neg ? ax : bx;
        
        const ay = b._bottom - a.collider._top;
        const by = b._top - a.collider._bottom;
        const is_y_neg = a.velocity_y < 0;
        yInvEntry = is_y_neg ? by : ay;
        yInvExit = is_y_neg ? ay : by;

        let xEntry = -Infinity, yEntry = -Infinity; 
        let xExit = Infinity, yExit = Infinity; 

        if (a.velocity_x != 0.0) 
        { 
            xEntry = xInvEntry / a.velocity_x; 
            xExit = xInvExit / a.velocity_x; 
        } 

        if (a.velocity_y != 0.0) 
        { 
            yEntry = yInvEntry / a.velocity_y; 
            yExit = yInvExit / a.velocity_y; 
        }

        if (yInvEntry > 1) yInvEntry = -Infinity;
        if (xInvEntry > 1) xInvEntry = -Infinity;

        let entryTime = Math.max(xEntry, yEntry); 
        let exitTime = Math.min(xExit, yExit);

        const overlapping = (xEntry < -1e-4 && yEntry < -1e-4);
        if (entryTime > exitTime || overlapping || xEntry > 1.0 || yEntry > 1.0) 
        { 
            ret.normal_x = 0;
            ret.normal_y = 0;
            ret.time = 1;
            return ret;
        }

        ret.normal_x = 0;
        ret.normal_y = 0;
        ret.time = entryTime;
        ret.time_x = xEntry;
        ret.time_y = yEntry;

        if (xEntry > yEntry) {
            ret.normal_x = xInvEntry < 0 ? 1 : -1;
        } else { 
            ret.normal_y = yInvEntry < 0 ? 1 : -1;
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