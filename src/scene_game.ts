import { Character, CharacterActionCode } from "./character";
import { SceneCollisions, BoxCollider } from './scene_collisions.js';
import { Box2, Vector2 } from "./lib/three.module";
import { addEventListener, removeEventListeners, EventListenerDetails } from "./document";
import CharacterRender from "./character_render";
import SceneRender from "./scene_render";

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

        let playerbox = new Box2().setFromCenterAndSize(new Vector2(0, 4), new Vector2(1, 1));
        const body = this.colliders.addBoxBody("player_character", playerbox);
        this.player_character = new Character().init(body);
        await this.player_character_render.run(this.player_character);

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
            this.scene_render.setPos(this.scene_render.camera, pos);
            this.scene_render.camera.lookAt(pos.x, pos.y, pos.z - 10);
        }
    }
    
    _keydown(event: KeyboardEvent) {
        const key = event.code;
        if (key === 'Space') {
            this.player_character.action("jump", CharacterActionCode.START);
        } else if (key === 'KeyA') {
            this.player_character.action("move_left", CharacterActionCode.START);
        } else if (key === 'KeyD') {
            this.player_character.action("move_right", CharacterActionCode.START);
        } else if (key === 'KeyS') {
            this.colliders.step(100);
        }
    }
    _keyup(event: KeyboardEvent) {
        const key = event.code;
        if (key === 'KeyA') {
            this.player_character.action("move_left", CharacterActionCode.END);
        } else if (key === 'KeyD') {
            this.player_character.action("move_right", CharacterActionCode.END);
        }
    }

    private player_character: Character;
    private player_character_render: CharacterRender;
    private scene_render: SceneRender;
    attach_camera_to_player: boolean;
    colliders: SceneCollisions;
    private _listeners: Array<EventListenerDetails>;
    private active: boolean;
    autostep: boolean;
}