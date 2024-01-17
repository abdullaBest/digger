import SceneMap from "../scene_map";
import SceneRender from "../render/scene_render";
import SceneCollisions from "../scene_collisions";

interface FallingBlockData {
    elapsed: number;
    shaking: boolean;
}

export default class SystemObjectsFall {
    scene_map: SceneMap;
    falling_objects: { [id: string] : FallingBlockData };
    scene_render: SceneRender;
    scene_collisions: SceneCollisions;

    constructor(scene_map: SceneMap, scene_render: SceneRender) {
        this.scene_map = scene_map;
        this.scene_render = scene_render;
        this.scene_collisions = scene_map.scene_collisions;
    }

    run() {
        this.falling_objects = {};
    }

    step(dt: number) {
        for(const k in this.falling_objects) {
            const b = this.falling_objects[k];

            const collider = this.scene_collisions.colliders[k];
            const body = this.scene_collisions.bodies[k];
            if (b.elapsed < 1) {
                if (!b.shaking) {
                    continue;
                }

                // a. 1 sec shaking, 
                const obj = this.scene_render.cache.objects[k];
                if (!obj || !collider) {
                    continue;
                }
                const refx = collider.x;
                const refy = collider.y;
                const x = refx + (Math.random() - 0.5) * 0.1;
                const y = refy + (Math.random() - 0.5) * 0.1;

                (obj as any).position.x = x;
                (obj as any).position.y = y;
            } else if (!this.scene_collisions.bodies[k]) {
                // b.1 falling
                this.scene_collisions.addBoxBody(k, collider);
                // b.2 make fall surrounding blocks
                this.touchFallingBlock(k, 0.01);
            } else if (body) {
                // c. deactivating
                for(let i = 0; i < body.contacts; i++) {
                    const c = body.contacts_list[i];
                    if (c && c.normal_y < 0 && c.time <= 0 && !this.scene_collisions.bodies[c.id ?? ""]) {
                        delete this.falling_objects[k];
                        this.scene_collisions.removeBody(k, false);
                        
                        const obj = this.scene_render.cache.objects[k];
                        const collider = this.scene_collisions.colliders[k];
                        if (obj) {
                            (obj as any).position.x  = collider.x;
                            (obj as any).position.y  = collider.y;
                        }
                    }
                }
            } 

            b.elapsed += dt;
        }
    }

    
    touchFallingBlock(id: string, shaketime: number = 1,) {
        const activate = (blockid: string) => {
            // b. iterate all blocks around activating block and find out if it stays on something
            const ca = this.scene_collisions.colliders[blockid];
            for (const k in this.scene_collisions.colliders) {
                if (k == id) {
                    continue;
                }
                const cb = this.scene_collisions.colliders[k];
                const collides_x = ca._left < cb._right && cb._left < ca._right;
                const collides_y = ca._bottom <= cb._top && cb._bottom <= ca._top;
                const ontop = ca.y > cb.y;
                if (collides_x && collides_y && ontop) {
                    if (this.falling_objects[k]) {
                        // other falling blocks atop already falling block
                        continue;
                    } else {
                        // do not activate if it stil stays on something
                        return;
                    }
                }
            }

            this.activateFallingBlock(blockid, shaketime);
        }

        // a. Iterate over all block around broken tile and try to activate falling blocks
        const ca = this.scene_collisions.colliders[id];
        if (!ca) {
            return;
        }
        for (const k in this.scene_collisions.colliders) {
            const cb = this.scene_collisions.colliders[k];
            const collides_x = ca._left < cb._right && cb._left < ca._right;
            const collides_y = ca._bottom <= cb._top && cb._bottom <= ca._top;
            const ontop = ca.y < cb.y;
            if (!collides_x || !collides_y || !ontop) {
                continue;
            }

            const model = this.scene_map.entities[k]?.components.model?.properties;
            if (model && model.tags && model.tags.includes("falling")) {
                activate(k);
            }
        }
    }

    activateFallingBlock(id: string, shaketime: number) {
        if (this.falling_objects[id]) {
            return;
        }

        this.falling_objects[id] = {
            elapsed: 1 - shaketime,
            shaking: true
        }
    }
}