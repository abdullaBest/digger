import { SceneCollisions, DynamicBody } from "../scene_collisions";

export default class GadgetGrapplingHook {
    scene_collisions: SceneCollisions;
    body: DynamicBody;

    dir_x: number;
    dir_y: number;
    summon_x: number;
    summon_y: number;
    target_x: number;
    target_y: number;

    throw_speed: number;
    retract_speed: number;
    length: number;

    elapsed: number;
    active: boolean;

    pos_x: number;
    pos_y: number;

    grapped: boolean;

    constructor(scene_collisions: SceneCollisions) {
        this.scene_collisions = scene_collisions;

        this.elapsed = 0;
        this.active = false;
        this.pos_x = 0;
        this.pos_y = 0;
        this.length = 5;
        this.throw_speed = 5;
        this.retract_speed = 5;
        this.dir_x = 0;
        this.dir_y = 0;

        this.grapped = false;
    }

    init(body: DynamicBody) {
        this.body = body;
    }

    shot(dir_x: number, dir_y: number, length: number, speed: number) : boolean {
        if (this.elapsed > 0) {
            return false;
        }

        this.active = true;
        this.grapped = false;
        this.dir_x = dir_x;
        this.dir_y = dir_y;
        this.length = length;
        this.throw_speed = speed;

        const rsx = this.body.collider.x + this.body.collider.width * 0.5 * this.dir_x;
        const rsy = this.body.collider.y + this.body.collider.height * 0.5 * this.dir_y;
        this.summon_x = rsx;
        this.summon_y = rsy;
        this.target_x = this.summon_x + this.length * this.dir_x;
        this.target_y = this.summon_y + this.length * this.dir_y;
        
        return true;
    }

    retract() {
        this.active = false;
        this.grapped = false;
    }

    step(dt: number) {
        if (!this.active && this.elapsed > 0) {
            //retracting (just animation)
            this.elapsed -= dt; 
        } else if (this.active && !this.grapped && this.elapsed * this.throw_speed < this.length) {
            // shooting forward
            this.elapsed += dt;
        } 
        
        if (this.elapsed <= 0) {
            // discardin time
            this.elapsed = 0;
            return;
        }

        // hook grapped. no more test required
        if (this.grapped) {
            return;
        }

        const ray_size = Math.min(this.length, this.elapsed * this.throw_speed);
        const fraction = (ray_size / this.length);

        const rsx = this.body.collider.x + this.body.collider.width * 0.5 * this.dir_x;
        const rsy = this.body.collider.y + this.body.collider.height * 0.5 * this.dir_y;
        const rex = rsx + (this.target_x - rsx) * fraction;
        const rey = rsy + (this.target_y - rsy) * fraction;

        if (!this.active) {
            // retracting state here. No collision test
            this.pos_x = rex;
            this.pos_y = rey;

            return;
        }

        const collision = this.scene_collisions.testRay(rsx, rsy, rex, rey);

        // if it hits and if it hits forwards
        if (collision.hit) {
            this.grapped = true;
            this.pos_x = collision.point_x;
            this.pos_y = collision.point_y;
            return;
        }
        

        this.pos_x = rex;
        this.pos_y = rey;
    }
}