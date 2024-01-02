import { Character, CharacterActionCode } from "./character";
import { SceneCollisions, BoxCollider } from './scene_collisions';
import { Box2, Vector2 } from "./lib/three.module";
import { addEventListener, removeEventListeners, EventListenerDetails } from "./document";
import CharacterRender from "./character_render";
import SceneRender from "./scene_render";
import { lerp } from "./math";

export default class SceneGame {
    constructor() {
        this.colliders = new SceneCollisions();
        this.player_character_render = new CharacterRender();
        this.autostep = true;
        this._listeners = [];
    }
    init(scene_render: SceneRender) {
        this.scene_render = scene_render;
        this.player_character_render.init(scene_render, this.colliders);
        this.attach_camera_to_player = false;
        return this;
    }

    async run() {
        this.stop();
        this.active = true;

        let playerbox = new Box2().setFromCenterAndSize(new Vector2(0.1, 4), new Vector2(0.5, 1));
        const body = this.colliders.addBoxBody("player_character", playerbox);
        this.player_character = new Character(this.colliders).init(body);
        await this.player_character_render.run(this.player_character);

        this.breakable_objects = {};

        addEventListener({callback: this._keydown.bind(this), name: "keydown", node: document.body}, this._listeners)
        addEventListener({callback: this._keyup.bind(this), name: "keyup", node: document.body}, this._listeners)
    }

    stop() {
        this.active = false;
        removeEventListeners(this._listeners);
        
        if(this.player_character) {
            this.colliders.remove(this.player_character.body.id);
        }
    }

    step(dt: number) {
        if (!this.active) {
            return;
        }
        this.player_character.step(dt);
        if (this.autostep) {
            this.colliders.step(dt);
        }
        this.player_character_render.step(dt);

        if (this.attach_camera_to_player && this.player_character_render.character_gltf) {
            const pos = this.scene_render.cache.vec3_0.copy(this.player_character_render.character_gltf.scene.position);
            pos.z = 10;
            const lposx = this.scene_render.camera.position.x;
            const lposy = this.scene_render.camera.position.y;
            pos.x = lerp(lposx, pos.x, 0.1);
            pos.y = lerp(lposy, pos.y, 0.1);
            this.scene_render.setPos(this.scene_render.camera, pos);
            this.scene_render.camera.lookAt(pos.x, pos.y, pos.z - 7);
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
        // Y look idrection in priority
        if (!cha.look_direction_y) {
            test_l = cha.body.collider._left + cha.body.collider.width * cha.look_direction_x * ray_size;
            test_r = cha.body.collider._right + cha.body.collider.width * cha.look_direction_x * ray_size;
        } else {
            test_t = cha.body.collider._top + cha.body.collider.width * cha.look_direction_y * ray_size;
            test_b = cha.body.collider._bottom + cha.body.collider.width * cha.look_direction_y * ray_size;
        }
        let hit_collider: string | null = null;
        for(const k in this.colliders.colliders) {
            const c = this.colliders.colliders[k];
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
    
    _keydown(event: KeyboardEvent) {
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
            this.colliders.step(100);
        } else if (key === 'KeyA') {
            this.player_character.actionRequest("hit", CharacterActionCode.START);
        }
    }
    _keyup(event: KeyboardEvent) {
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
    colliders: SceneCollisions;

    attach_camera_to_player: boolean;

    breakable_objects: {[id: string]: number}

    private _listeners: Array<EventListenerDetails>;
    private active: boolean;
    autostep: boolean;
}