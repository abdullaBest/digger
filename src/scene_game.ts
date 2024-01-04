import { Character, CharacterActionCode } from "./character";
import { SceneCollisions, BoxCollider } from './scene_collisions';
import { Box2, Vector2 } from "./lib/three.module";
import { addEventListener, removeEventListeners, EventListenerDetails } from "./document";
import CharacterRender from "./character_render";
import SceneRender from "./scene_render";
import { lerp } from "./math";

interface FallingBlockData {
    elapsed: number;
}

export default class SceneGame {
    constructor() {
        this.scene_collisions = new SceneCollisions();
        this.player_character_render = new CharacterRender();
        this.autostep = true;
        this._listeners = [];
        this.falling_blocks = {};
    }
    init(scene_render: SceneRender) {
        this.scene_render = scene_render;
        this.player_character_render.init(scene_render, this.scene_collisions);
        this.attach_camera_to_player = false;
        return this;
    }

    async run() {
        this.stop();
        this.active = true;

        let playerbox = new Box2().setFromCenterAndSize(new Vector2(0.1, 4), new Vector2(0.5, 0.6));
        const body = this.scene_collisions.createBoxBody("player_character", playerbox);
        this.player_character = new Character(this.scene_collisions).init(body);
        await this.player_character_render.run(this.player_character);

        this.breakable_objects = {};

        addEventListener({callback: this._keydown.bind(this), name: "keydown", node: document.body}, this._listeners)
        addEventListener({callback: this._keyup.bind(this), name: "keyup", node: document.body}, this._listeners)
        addEventListener({callback: ()=> {
            console.log("blur");
            this.player_character.actionRequest("move_left", CharacterActionCode.END);
            this.player_character.actionRequest("move_right", CharacterActionCode.END)
        }, name: "blur", node: window as any}, this._listeners)
        //addEventListener({callback: ()=> {console.log("focus")}, name: "focus", node: window as any}, this._listeners)
    }

    stop() {
        this.active = false;
        removeEventListeners(this._listeners);
        
        if(this.player_character) {
            this.player_character_render.stop();
            this.scene_collisions.removeBody(this.player_character.body.id, true);
        }
    }

    /**
     * 
     * @param dt 
     * @param dr 
     * @returns 
     */
    step(dt: number, dr: number) {
        if (!this.active) {
            return;
        }
        this.player_character.step(dt, dr);
        if (this.autostep) {
            this.scene_collisions.step(dt);
        }
        this.player_character_render.step(dt, dr);

        this.stepFallingBlocks(dt);

        if (this.attach_camera_to_player && this.player_character_render.character_gltf) {
            const pos = this.scene_render.cache.vec3_0.copy(this.player_character_render.character_gltf.scene.position);

            pos.z = 7;
            const lposx = (this.scene_render.camera as any).position.x;
            const lposy = (this.scene_render.camera as any).position.y;
            const shift_y = 1;
            const targ_y = pos.y + shift_y;
            pos.x = lerp(lposx, pos.x, Math.pow(Math.abs(lposx - pos.x), 2) * 0.05 * dr);
            pos.y = lerp(lposy, targ_y, Math.pow(Math.abs(lposy - targ_y), 2) * 0.05 * dr);

            //pos.y = lerp(pos.y, pos.y - this.player_character.look_direction_y * 2, 0.1);

            this.scene_render.setPos(this.scene_render.camera, pos);

            pos.z -= 7;

            this.scene_render.camera.lookAt(pos.x, targ_y - shift_y, pos.z);
        }

        if(this.player_character.performed_actions.find((e) => e.tag == "hit")) { 
            this._actionHit();
        }
    }

    private _actionHitCollisionTest(cha: Character): string | null {
        const tile_size = 1;
        const ray_size = tile_size * 0.9;
        // default in center
        let test_l = cha.body.collider.pos_x;
        let test_r = cha.body.collider.pos_x;
        let test_t = cha.body.collider.pos_y;
        let test_b = cha.body.collider.pos_y;

        // shift ray towards look x direction.
        // Y look direction in priority
        if (!cha.look_direction_y) {
            test_l = cha.body.collider._left + cha.body.collider.width * cha.look_direction_x * ray_size;
            test_r = cha.body.collider._right + cha.body.collider.width * cha.look_direction_x * ray_size;
        } else {
            test_t = cha.body.collider._top + cha.body.collider.width * cha.look_direction_y * ray_size;
            test_b = cha.body.collider._bottom + cha.body.collider.width * cha.look_direction_y * ray_size;
        }
        let hit_collider: string | null = null;
        for(const k in this.scene_collisions.colliders) {
            const c = this.scene_collisions.colliders[k];
            const collides_x = test_l <= c._right && c._left <= test_r;
            const collides_y = test_b <= c._top && c._bottom <= test_t;
            if (collides_x && collides_y) {
                hit_collider = k;
                break;
            }
        }

        return hit_collider;
    }

    private _actionHit() {
        const hit_result = this._actionHitCollisionTest(this.player_character);
        if (!hit_result) {
            return;
        }

        const hit_damage = 2;

        const durability = this.breakable_objects[hit_result] ?? this.scene_render.cache.models[hit_result].durability;
        if (!durability) {
            return;
        }

        let endurance = (durability & 0xF0) >> 4;
        let resistance = durability & 0x0F;
        if (durability > 0xFF) {
            endurance = (durability & 0xFF) >> 8;
            resistance = durability & 0x00FF;
        }

        if (hit_damage <= resistance) {
            return;
        }

        endurance -= hit_damage - resistance;
        if (endurance <= 0) {
            // falling block activate
            this.findFallingBlockAround(hit_result);
            

            // remove breakable block
            this.scene_render.removeModel(hit_result);
            delete this.breakable_objects[hit_result];
            
            return;
        }

        let newdurability = ((endurance << 4) & 0xF0) + ((resistance) & 0x0F);
        if (durability > 0xFF) {
            newdurability = ((endurance << 8) & 0xFF00) + ((resistance) & 0x00FF);
        }

        this.breakable_objects[hit_result] = newdurability;
    }

    findFallingBlockAround(id: string) {
        const activate = (blockid: string) => {
            // b. iterate all blocks around activating block and find out if it stays on something
            const ca = this.scene_collisions.colliders[blockid]
            for (const k in this.scene_collisions.colliders) {
                if (k == id) {
                    continue;
                }
                const cb = this.scene_collisions.colliders[k];
                const collides_x = ca._left < cb._right && cb._left < ca._right;
                const collides_y = ca._bottom <= cb._top && cb._bottom <= ca._top;
                const ontop = ca.pos_y > cb.pos_y;
                if (collides_x && collides_y && ontop) {
                    // do not activate if it stil stays on something
                    return;
                }
            }

            this.activateFallingBlock(blockid);
        }

        // a. Iterate over all block around broken tile and try to activate falling blocks
        const ca = this.scene_collisions.colliders[id];
        for (const k in this.scene_collisions.colliders) {
            const cb = this.scene_collisions.colliders[k];
            const collides_x = ca._left < cb._right && cb._left < ca._right;
            const collides_y = ca._bottom <= cb._top && cb._bottom <= ca._top;
            const ontop = ca.pos_y < cb.pos_y;
            if (!collides_x || !collides_y || !ontop) {
                continue;
            }

            const model = this.scene_render.cache.models[k];
            if (model.tags && model.tags.includes("falling")) {
                activate(k);
            }
        }
    }

    activateFallingBlock(id: string) {
        if (this.falling_blocks[id]) {
            return;
        }

        this.falling_blocks[id] = {
            elapsed: 0
        }
    }
    
    stepFallingBlocks(dt: number) {
        for(const k in this.falling_blocks) {
            const b = this.falling_blocks[k];
            b.elapsed += dt;

            const collider = this.scene_collisions.colliders[k];
            const body = this.scene_collisions.bodies[k];
            if (b.elapsed < 1) {
                // a. 1 sec shaking, 
                const obj = this.scene_render.cache.objects[k];
                if (!obj || !collider) {
                    continue;
                }
                const refx = collider.pos_x;
                const refy = collider.pos_y;
                const x = refx + (Math.random() - 0.5) * 0.1;
                const y = refy + (Math.random() - 0.5) * 0.1;

                obj.position.x = x;
                obj.position.y = y;
            } else if (!this.scene_collisions.bodies[k]) {
                // b. falling
                this.scene_collisions.addBoxBody(k, collider);
            } else if (body) {
                // c. deactivating
                for(let i = 0; i < body.contacts; i++) {
                    const c = body.contacts_list[i];
                    if (c && c.normal_y < 0 && c.time <= 0) {
                        delete this.falling_blocks[k];
                        this.scene_collisions.removeBody(k, false);
                    }
                }
            }
        }
    }
    
    _keydown(event: KeyboardEvent) {
        if (event.repeat) return;

        const key = event.code;
        if (key === 'Space') {
            this.player_character.actionRequest("jump", CharacterActionCode.START);
        } 
        else if (key === 'ArrowLeft') {
            this.player_character.actionRequest("move_left", CharacterActionCode.START);
        } else if (key === 'ArrowRight') {
            this.player_character.actionRequest("move_right", CharacterActionCode.START);
        } else if (key === 'ArrowUp') {
            this.player_character.actionRequest("look_up", CharacterActionCode.START);
        } else if (key === 'ArrowDown') {
            this.player_character.actionRequest("look_down", CharacterActionCode.START);
        } 
        else if (key === 'KeyS') {
            this.scene_collisions.step(100);
        } else if (key === 'KeyA') {
            this.player_character.actionRequest("hit", CharacterActionCode.START);
        }
    }
    _keyup(event: KeyboardEvent) {
        if (event.repeat) return;
        
        const key = event.code;
        if (key === 'ArrowLeft') {
            this.player_character.actionRequest("move_left", CharacterActionCode.END);
        } else if (key === 'ArrowRight') {
            this.player_character.actionRequest("move_right", CharacterActionCode.END);
        } else if (key === 'ArrowUp') {
            this.player_character.actionRequest("look_up", CharacterActionCode.END);
        } else if (key === 'ArrowDown') {
            this.player_character.actionRequest("look_down", CharacterActionCode.END);
        }
    }

    private player_character: Character;
    private player_character_render: CharacterRender;
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;

    attach_camera_to_player: boolean;

    breakable_objects: {[id: string]: number}
    falling_blocks: {[id: string]: FallingBlockData}

    private _listeners: Array<EventListenerDetails>;
    private active: boolean;
    autostep: boolean;
}