import { Character, CharacterActionCode } from "./character";
import { SceneCollisions, BoxColliderC } from './scene_collisions';
import { Box2, Vector2 } from "./lib/three.module";
import { addEventListener, removeEventListeners, EventListenerDetails } from "./document";
import CharacterRender from "./character_render";
import SceneRender from "./scene_render";
import { distlerp, lerp } from "./math";
import { SceneElement } from "./scene_edit";
import SceneDebug from "./scene_debug";

interface FallingBlockData {
    elapsed: number;
    shaking: boolean;
}

export default class SceneGame {
    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;

        this.player_character_render = new CharacterRender();
        this.autostep = true;
        this._listeners = [];
        this.falling_blocks = {};
        this.requested_map_switch = null;
        this.requested_map_entrance = null;
    }
    
    async init(): Promise<SceneGame> {
        this.player_character_render.init(this.scene_render, this.scene_collisions);
        this.attach_camera_to_player = false;
        await this.scene_collisions.init();
        this.scene_debug = new SceneDebug();

        return this;
    }

    async run(elements: { [id: string] : SceneElement; }, entrance_id?: string | null) {
        this.stop();

        this.requested_map_switch = null;
        this.requested_map_entrance = null;
        this.active = true;
        this.elements = elements;

        // find start pos
        const startpos = new Vector2(0.1, 4);
        {
            let entrance_found = false;
            for(const k in elements) {
                const el = elements[k];
                const props = el.components.trigger?.properties;
                if (!entrance_id && props && props.type == "mapentry") {
                    startpos.x = props.pos_x ?? 0;
                    startpos.y = props.pos_y ?? 0;
                    entrance_found = true;
                } else if (entrance_id && el.id === entrance_id) {
                    startpos.x = props.pos_x ?? 0;
                    startpos.y = props.pos_y ?? 0;
                    entrance_found = true;
                }

                if (entrance_found) {
                    break;
                }
            }

            if (entrance_id && !entrance_found) {
                console.warn(`SceneGame::run warn - entrance id set (${entrance_id}) but such element wasnt found`);
            }
        }

        // init player
        let playerbox = new Box2().setFromCenterAndSize(startpos, new Vector2(0.5, 0.6));
        const body = this.scene_collisions.createBoxBody("player_character", playerbox);
        this.player_character = new Character(this.scene_collisions).init(body);
        await this.player_character_render.run(this.player_character);

        // teleport it at start
        this.player_character_render.character_gltf.scene.position.set(startpos.x, startpos.y, 0);

        // teleport camera
        if (this.attach_camera_to_player) {
            const pos = this.scene_render.cache.vec3_0.set(startpos.x, startpos.y, 10);
            this.scene_render.setPos(this.scene_render.camera, pos);
        }

        this.breakable_objects = {};

        addEventListener({callback: this._keydown.bind(this), name: "keydown", node: document.body}, this._listeners)
        addEventListener({callback: this._keyup.bind(this), name: "keyup", node: document.body}, this._listeners)
        addEventListener({callback: ()=> {
            this.player_character.actionRequest("move_left", CharacterActionCode.END);
            this.player_character.actionRequest("move_right", CharacterActionCode.END)
        }, name: "blur", node: window as any}, this._listeners)
        //addEventListener({callback: ()=> {console.log("focus")}, name: "focus", node: window as any}, this._listeners)

        this.scene_debug.run(this.player_character);
    }

    stop() {
        this.active = false;
        this.requested_map_switch = null;
        this.requested_map_entrance = null;
        this.scene_debug.stop();
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
    step(dt: number, dr: number, forced: boolean = false) {
        if (!this.active) {
            return;
        }
        if (!this.autostep && !forced) {
            return
        }
        this.player_character.step(dt, dr);
        this.scene_collisions.step(dt);
        this.player_character_render.step(dt, dr);
        this.scene_debug.step();

        this.stepFallingBlocks(dt);

        if (this.attach_camera_to_player && this.player_character_render.character_gltf) {
            const pos = this.scene_render.cache.vec3_0.copy(this.player_character_render.character_gltf.scene.position);

            pos.z = 7;
            const lposx = (this.scene_render.camera as any).position.x;
            const lposy = (this.scene_render.camera as any).position.y;
            const shift_y = 1;
            const targ_y = pos.y + shift_y;
            pos.x = distlerp(lposx, pos.x, 0.4, 3);
            pos.y = distlerp(lposy, targ_y, 0.4, 3);

            //pos.y = lerp(pos.y, pos.y - this.player_character.look_direction_y * 2, 0.1);

            const targ = this.scene_render.cache.vec3_1.set(pos.x, targ_y - shift_y, pos.z - 7)
            this.scene_render.setCameraPos(pos, targ);
        }

        if(this.player_character.performed_actions.find((e) => e.tag == "hit")) { 
            this._actionHit();
        }

        this._stepCharacterInteractions(this.player_character);
    }

    private _stepCharacterInteractions(cha: Character) {
        let interacts = false;

        const proceedMapExitInteraction = (el: SceneElement) => {
            if(this.player_character.performed_actions.find((e) => e.tag == "look_up")) {
                const props = el?.components.trigger?.properties;
                const signal = props.signal;
                if (signal) {
                    this.requestMapSwitch(signal);
                }
            }
        }

        for(const k in cha.body.contacts_list) {
            const cid = cha.body.contacts_list[k].id;
            if (!cid) {
                continue;
            }
            const el = this.elements[cid];
            const props = el?.components.trigger?.properties;
            if (props && props.type == "mapexit") {
                interacts = true;
                proceedMapExitInteraction(el);
                break;
            }
        }

        this.player_character_render.drawUiInteractSprite(interacts);
    }

    requestMapSwitch(signal: string) {
        // it gonna be handled in SceneMediator step
        const args = signal.split(",");
        const id = args[0];
        const entrance_id = args[1] ?? null;
        this.requested_map_switch = id;
        this.requested_map_entrance = entrance_id;
    }

    private _actionHitCollisionTest(cha: Character): string | null {
        const tile_size = 1;
        const ray_size = tile_size * 0.9;
        // default in center
        let test_l = cha.body.collider.x;
        let test_r = cha.body.collider.x;
        let test_t = cha.body.collider.y;
        let test_b = cha.body.collider.y;

        // shift ray towards look x direction.
        // Y look direction in priority
        if (!cha.look_direction_y) {
            test_l = cha.body.collider.x + cha.body.collider.width * 0.5 * cha.look_direction_x + ray_size * cha.look_direction_x;
            test_r = cha.body.collider.x + cha.body.collider.width * 0.5 * cha.look_direction_x + ray_size * cha.look_direction_x;
        } else {
            test_t = cha.body.collider.y + cha.body.collider.height * 0.5 * cha.look_direction_y + ray_size * cha.look_direction_y;
            test_b = cha.body.collider.y + cha.body.collider.height * 0.5 * cha.look_direction_y + ray_size * cha.look_direction_y;
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

        const hit_damage = 1;
        const hit_strength = 1;

        const durability = this.breakable_objects[hit_result] ?? this.scene_render.cache.models[hit_result]?.durability;
        if (!durability) {
            return;
        }

        let endurance = (durability & 0xF0) >> 4;
        let resistance = durability & 0x0F;
        if (durability > 0xFF) {
            endurance = (durability & 0xFF) >> 8;
            resistance = durability & 0x00FF;
        }

        if (hit_strength <= resistance) {
            return;
        }

        endurance -= hit_damage;
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

    findFallingBlockAround(id: string, shaketime: number = 1,) {
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
                    if (this.falling_blocks[k]) {
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

            const model = this.scene_render.cache.models[k];
            if (model && model.tags && model.tags.includes("falling")) {
                activate(k);
            }
        }
    }

    activateFallingBlock(id: string, shaketime: number) {
        if (this.falling_blocks[id]) {
            return;
        }

        this.falling_blocks[id] = {
            elapsed: 1 - shaketime,
            shaking: true
        }
    }
    
    stepFallingBlocks(dt: number) {
        for(const k in this.falling_blocks) {
            const b = this.falling_blocks[k];

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

                obj.position.x = x;
                obj.position.y = y;
            } else if (!this.scene_collisions.bodies[k]) {
                // b.1 falling
                this.scene_collisions.addBoxBody(k, collider);
                // b.2 make fall surrounding blocks
                this.findFallingBlockAround(k, 0.1);
            } else if (body) {
                // c. deactivating
                for(let i = 0; i < body.contacts; i++) {
                    const c = body.contacts_list[i];
                    if (c && c.normal_y < 0 && c.time <= 0 && !this.scene_collisions.bodies[c.id ?? ""]) {
                        delete this.falling_blocks[k];
                        this.scene_collisions.removeBody(k, false);
                        
                        const obj = this.scene_render.cache.objects[k];
                        const collider = this.scene_collisions.colliders[k];
                        if (obj) {
                            obj.position.x  = collider.x;
                            obj.position.y  = collider.y;
                        }
                    }
                }
            } 

            b.elapsed += dt;
        }
    }
    
    _keydown(event: KeyboardEvent) {
        if (event.repeat) return;

        const key = event.code;
        if (key === 'Space') {
            this.player_character.actionRequest("jump", CharacterActionCode.START);
        } else if (key === "ShiftLeft") {
            this.player_character.actionRequest("run", CharacterActionCode.START);
        }
        else if (key === 'ArrowLeft') {
            this.player_character.actionRequest("move_left", CharacterActionCode.START);
        } else if (key === 'ArrowRight') {
            this.player_character.actionRequest("move_right", CharacterActionCode.START);
        } else if (key === 'ArrowUp') {
            this.player_character.actionRequest("look_up", CharacterActionCode.START);
        } else if (key === 'ArrowDown') {
            this.player_character.actionRequest("look_down", CharacterActionCode.START);
        } else if (key === 'KeyA') {
            this.player_character.actionRequest("hit", CharacterActionCode.START);
        }
        else if (key === 'KeyS') {
            this.step(0.016, 1, true);
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
        } else if (key === "ShiftLeft") {
            this.player_character.actionRequest("run", CharacterActionCode.END);
        }
    }

    player_character: Character;
    private player_character_render: CharacterRender;
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    scene_debug: SceneDebug;

    attach_camera_to_player: boolean;

    breakable_objects: {[id: string]: number}
    falling_blocks: {[id: string]: FallingBlockData}

    private _listeners: Array<EventListenerDetails>;
    private active: boolean;
    autostep: boolean;
    elements: { [id: string] : SceneElement; }

    requested_map_switch: string | null;
    requested_map_entrance: string | null;
}