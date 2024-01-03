import { DynamicBody, SceneCollisions } from "./scene_collisions";
import { lerp } from "./math";

enum CharacterActionCode {
    DEFAULT = 0,
    START = 1,
    END = 2
}

interface CharacterAction {
    tag: string;
    code: CharacterActionCode;
}

class Character {
    body: DynamicBody;

    movement_x: number;
    moving_left: boolean;
    moving_right: boolean;
    movement_speed: number;

    jumping_up: boolean;
    jumping_left: boolean;
    jumping_right: boolean;
    jump_force: number;
    jump_threshold: number;
    jump_elapsed: number;
    scene_collisions: SceneCollisions;
    look_direction_x: number;
    look_direction_y: number;

    collided_left: boolean;
    collided_right: boolean;
    collided_top: boolean;
    collided_bottom: boolean;

    // actions that should be executed next step
    requested_actions: Array<CharacterAction>;
    // actions that was executed previous step
    performed_actions: Array<CharacterAction>;

    constructor(scene_collisions: SceneCollisions) {
        this.look_direction_x = 0;
        this.look_direction_y = 0;
        this.movement_x = 0;
        this.movement_speed = 4;
        this.jump_force = 6;
        this.jump_threshold = 0.15;
        this.jump_elapsed = 0;
        this.moving_right = false;
        this.moving_left = false;
        this.jumping_left = false;
        this.jumping_right = false;
        this.jumping_up = false;
        this.requested_actions = [];
        this.performed_actions = [];
        this.scene_collisions = scene_collisions;
        this.collided_bottom = false;
        this.collided_left = false;
        this.collided_right = false;
        this.collided_top = false;
    }

    init(body: DynamicBody) : Character {
        this.body = body;

        return this;
    }

    step(dt: number) {
        // zero-out step variables
        this.performed_actions.length = 0;
        let movement = 0;
        this.jumping_left = this.jumping_right = this.jumping_up = false;

        this.updateCollideDirections();

        // apply actions
        while(this.requested_actions.length) {
            const action = this.requested_actions.pop();
            if (action) {
                this._action(action);
            }
        }

        // movement
        movement -= this.moving_left ? this.movement_speed : 0;
        movement += this.moving_right ? this.movement_speed : 0;
        this.movement_x = lerp(this.movement_x, movement, 0.7);
        if (Math.abs(this.movement_x) < 1e-4) {
            this.movement_x = 0;
        }
        this.body.velocity_x = lerp(this.body.velocity_x, this.movement_x, 0.3);
        if (Math.abs(this.body.velocity_x) < 1e-4) {
            this.body.velocity_x = 0;
        }
        if(movement) {
            this.look_direction_x = Math.sign(movement);
        }

        // jump
        if (this.jump_elapsed > this.jump_threshold) {
            if (this.jumping_left || this.jumping_right || this.jumping_up) {
                this.jump_elapsed = 0;
            }
            //this.body.velocity_x = this.jumping_left ? this.jump_force : this.body.velocity_x;
            //this.body.velocity_x = this.jumping_right ? this.jump_force : this.body.velocity_x;
            this.body.velocity_y = this.jumping_up ? Math.max(this.body.velocity_y, this.jump_force): this.body.velocity_y;
        }
        this.jump_elapsed += dt;
    }

    updateCollideDirections() {
        // left "collided" untouched if no movemend was happen
        this.collided_left = false;
        this.collided_right = false;
        this.collided_bottom = false;
        this.collided_top = false;

        for (let i = 0; i < this.body.contacts; i++) {
            const c = this.body.contacts_list[i];
            if (!c.normal_x && !c.normal_y) {
                continue;
            }
            if (c.normal_y == -1) {
                this.collided_bottom = true;
            } else  if (c.normal_y == 1) {
                this.collided_top = true;
            } else  if (c.normal_x == -1) {
                this.collided_left = true;
            } else  if (c.normal_x == 1) {
                this.collided_right = true;
            }
        }
    }


    private _actiunJump(): boolean {
        const freejump = false;

        if (freejump) {
            this.jumping_up = true;
        } else {
            // floor jump
            this.jumping_up = this.collided_bottom;

            // wall jump
            this.jumping_left = !this.jumping_up && this.collided_left;
            this.jumping_right = !this.jumping_up && this.collided_right;
            this.jumping_up =  this.jumping_up || this.jumping_left || this.jumping_right;
        }

        return this.jumping_up || this.jumping_left || this.jumping_right;
    }

    private _action(action: CharacterAction) {
        const tag = action.tag;
        const code = action.code;
        switch(tag) {
            case "jump":
                if (this._actiunJump() ) {
                    this.performed_actions.push(action);
                }
                break;
            case "hit":
                this.performed_actions.push(action);
                break;
            case "move_left":
                this.moving_left = code == CharacterActionCode.START;
                this.performed_actions.push(action);
                break;
            case "move_right":
                this.moving_right = code == CharacterActionCode.START;
                this.performed_actions.push(action);
                break;
            case "look_up":
                this.look_direction_y = code == CharacterActionCode.START ? 1 : 0;
                break;
            case "look_down":
                this.look_direction_y = code == CharacterActionCode.START ? -1 : 0;
                break;
            default:
                console.warn(`no action ${tag} defined`);
        }
    }

    actionRequest(tag: string, code: CharacterActionCode = 0) {
        this.requested_actions.push({tag, code});
    }
}

export default Character;
export { Character, CharacterActionCode };