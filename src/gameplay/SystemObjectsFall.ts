import SceneCore from "../scene_core";
import SceneRender from "../render/scene_render";
import SceneCollisions from "../scene_collisions";
import { AssetContentTypeComponent } from "../assets";

interface FallingBlockData {
    collider: string;
    elapsed: number;
    shaking: boolean;
}

export default class SystemObjectsFall {
    scene_core: SceneCore;
    falling_objects: { [id: string] : FallingBlockData };
    scene_render: SceneRender;
    scene_collisions: SceneCollisions;

    constructor(scene_core: SceneCore, scene_render: SceneRender) {
        this.scene_core = scene_core;
        this.scene_render = scene_render;
        this.scene_collisions = scene_core.scene_collisions;
    }

    run() {
        this.falling_objects = {};
    }

    step(dt: number) {
        for(const k in this.falling_objects) {
            const b = this.falling_objects[k];

            const collider = this.scene_collisions.colliders[b.collider];
            const body = this.scene_collisions.bodies[b.collider];
        
            if (!collider) {
                continue;
            }
            
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
            } else if (!this.scene_collisions.bodies[b.collider] && collider) {
                // b.1 falling
                this.scene_collisions.addBoxBody(b.collider, collider);
                // b.2 make fall surrounding blocks
                this.touchFallingBlock(b.collider, 0.01);
            } else if (body) {
                // c. deactivating
                for(let i = 0; i < body.contacts; i++) {
                    const c = body.contacts_list[i];
                    if (c && c.normal_y < 0 && c.time <= 0 && !this.scene_collisions.bodies[c.id ?? ""]) {
                        delete this.falling_objects[k];
                        this.scene_collisions.removeBody(b.collider, false);
                        
                        const obj = this.scene_render.cache.objects[k];
                        const collider = this.scene_collisions.colliders[b.collider];
                        if (obj) {
                            (obj as any).position.x  = collider.x;
                            (obj as any).position.y  = collider.y;
                        }
                    }
                }

                let component = this.scene_core.components[k];

                // #debt-tilerefs: saving position for tile instance in tile reference - it not gonna be destroyed durning tileset cleanup
                if ((component as any).tileref && component.inherites) {
                    component = this.scene_core.matters.get(component.inherites) as AssetContentTypeComponent;
                }
                if (component) {
                    component.pos_x = collider.x;
                    component.pos_y = collider.y;
                }
            } 

            b.elapsed += dt;
        }
    }

    
    touchFallingBlock(id: string, shaketime: number = 1,) {
        const activate = (blockid: string, colliderid: string) => {
            // b. iterate all blocks around activating block and find out if it stays on something
            const ca = this.scene_collisions.colliders[colliderid];
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

            this.activateFallingBlock(blockid, colliderid, shaketime);
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

            let component = this.scene_core.components[k] as any;
            while(component && !component.gameprop && component.owner) {
                component = this.scene_core.matters.get(component.owner);
            }
            if (!component || !component.gameprop) {
                return;
            }
            if ((this.scene_core.matters.get(component.gameprop) as any)?.falling) {
                activate(component.id, k);
            }
        }
    }

    activateFallingBlock(id: string, colliderid: string, shaketime: number) {
        if (this.falling_objects[id]) {
            return;
        }

        this.falling_objects[id] = {
            collider: colliderid,
            elapsed: 1 - shaketime,
            shaking: true
        }
    }
}