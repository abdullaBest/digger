import Character from "./character";
import { SceneCollisions, BoxCollider } from './scene_collisions.js';
import { Box2, Vector2 } from "./lib/three.module";
import { addEventListener, EventListenerDetails } from "./document";
export default class SceneGame {
    constructor() {
        this.colliders = new SceneCollisions();
        this._listeners = [];
    }
    init() {

    }

    run() {
        this.stop();
        this.active = true;

        let playerbox = new Box2().setFromCenterAndSize(new Vector2(0, 1), new Vector2(1, 1));
        const body = this.colliders.addBoxBody("player_character", playerbox);
        this.player_character = new Character().init(body);

        this._listeners.push(addEventListener({callback: this._keydown.bind(this), name: "keydown", node: document.body}))
        this._listeners.push(addEventListener({callback: this._keyup.bind(this), name: "keyup", node: document.body}))
    }

    stop() {
        this.active = false;
        while(this._listeners.length) {
            const l = this._listeners.pop();
            l?.node.removeEventListener(l.name, l.callback);
        }
        if(this.player_character) {
            this.colliders.remove(this.player_character.body.id);
        }
    }

    step(dt: number) {
        if (!this.active) {
            return;
        }
        this.player_character.step();
        this.colliders.step();
    }
    
    _keydown(event: KeyboardEvent) {
        const key = event.code;
        if (key === 'Space') {
            this.player_character.action("jump");
        } else if (key === 'KeyA') {
            this.player_character.action("move_left");
        } else if (key === 'KeyD') {
            this.player_character.action("move_right");
        } else if (key === 'KeyS') {
            this.colliders.step(1);
        }
    }
    _keyup(event: KeyboardEvent) {
        const key = event.code;
        if (key === "KeyA" || key === "KeyD") {
            this.player_character.action("move_stop");
        }
    }

    private player_character: Character;
    colliders: SceneCollisions;
    private _listeners: Array<EventListenerDetails>;
    private active: boolean;
}