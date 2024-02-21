import SceneCore from "../app/scene_core";
import SceneRender from "../scene_render";
import { SceneCollisions, BoxColliderC } from "../app/scene_collisions";
import { lerp, distlerp } from "../core/math";
import { AssetContentTypeComponent } from "../app/assets";

class BodiesPosStepInfo {
    pos_x: number;
    pos_y: number;
    prev_x: number;
    prev_y: number;
    next_x: number;
    next_y: number;

    constructor(collider: BoxColliderC) {
        this.pos_x = 0;
        this.pos_y = 0;
        this.next_x = collider.x;
        this.next_y = collider.y;
        this.prev_x = this.next_x;
        this.prev_y = this.next_y;
    }

    update(collider: BoxColliderC) {
        this.prev_x = this.next_x;
        this.prev_y = this.next_y;
        this.next_x = collider.x;
        this.next_y = collider.y;
    }
}

export default class SystemRenderBodiesPos {
    scene_core: SceneCore;
    scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    stepinfos: { [id: string] : BodiesPosStepInfo }
    step_number: number;
    elapsed: number;

    constructor(scene_core: SceneCore, scene_render: SceneRender) {
        this.scene_core = scene_core;
        this.scene_render = scene_render;
        this.scene_collisions = scene_core.scene_collisions;
    }

    run() {
        this.stepinfos = {};
    }

    step(dt: number) {
        const updatestepinfos = this.step_number != this.scene_collisions.step_number;
        if (updatestepinfos) {
            this.step_number = this.scene_collisions.step_number;
            this.elapsed = 0;
        }

        for(const k in this.scene_collisions.bodies) {
            const collider = this.scene_collisions.bodies[k].collider;
            let object = this.scene_render.cache.objects[k];

            if (!object) {
                const component = this.scene_core.matters.get(k) as AssetContentTypeComponent;
                if (component?.owner) {
                    object = this.scene_render.cache.objects[component.owner]
                }
            }

            if (!collider || !object) {
                delete this.stepinfos[k];
                continue;
            }

            let stepinfo = this.stepinfos[k];
            if (!stepinfo) {
                stepinfo = this.stepinfos[k] = new BodiesPosStepInfo(collider);
            }
            if (updatestepinfos) {
                stepinfo.update(collider);
            }

            let x = lerp(stepinfo.prev_x, stepinfo.next_x, this.elapsed / (this.scene_collisions.last_step_elapsed));
            let y = lerp(stepinfo.prev_y, stepinfo.next_y, this.elapsed / (this.scene_collisions.last_step_elapsed));
            //x += body.velocity_x * this.colliders.step_threshold * 0.5;
            //y += body.velocity_y * this.colliders.step_threshold * 0.5;
        
            let lx = distlerp(stepinfo.pos_x, x, 1e-4, 1e-1);
            let ly = distlerp(stepinfo.pos_y, y, 1e-4, 1e-1);
            //let lx = lerp(stepinfo.pos_x, x, Math.max(0, 0.1 - Math.abs(stepinfo.pos_x - x)));
            //let ly = lerp(stepinfo.pos_y, y, 0.1);
            stepinfo.pos_x = lx;
            stepinfo.pos_y = ly;

            this.scene_render.setPos(object, this.scene_render.cache.vec3_0.set(lx, ly, 0));
        }

        this.elapsed += dt;
    }
}
