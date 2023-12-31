import { DynamicBody, SceneCollisions } from "./scene_collisions";
import { lerp } from "./math";

enum CharacterActionCode {
    DEFAULT = 0,
    START = 1,
    END = 2
}

class Character {
    body: DynamicBody;
    movement_x: number;
    moving_left: boolean;
    moving_right: boolean;
    movement_speed: number;
    jump_force: number;

    constructor() {
        this.movement_x = 0;
        this.movement_speed = 4;
        this.jump_force = 6;
        this.moving_right = false;
        this.moving_left = false;
    }

    init(body: DynamicBody) : Character {
        this.body = body;

        return this;
    }

    step(dt: number) {
        let movement = 0;
        movement -= this.moving_left ? this.movement_speed : 0;
        movement += this.moving_right ? this.movement_speed : 0;

        this.movement_x = lerp(this.movement_x, movement, 0.7);
        if (Math.abs(this.movement_x) < 1e-4) {
            this.movement_x = 0;
        }
        this.body.velocity_x = lerp(this.body.velocity_x, this.movement_x, 0.3);
    }

    action(tag: string, code: CharacterActionCode = 0) {
        switch(tag) {
            case "jump":
                this.body.velocity_y = this.jump_force;
                break;
            case "move_left":
                this.moving_left = code == CharacterActionCode.START;
                break;
            case "move_right":
                this.moving_right = code == CharacterActionCode.START;
                break;
        }
    }
}

export default Character;
export { Character, CharacterActionCode };