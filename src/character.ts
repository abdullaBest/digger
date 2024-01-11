import { DynamicBody, SceneCollisions } from "./scene_collisions";
import { lerp } from "./math";

enum CharacterActionCode {
    DEFAULT = 0,
    START = 1,
    END = 2
}

enum CharacterActionApplyCode {
    DEFAULT = 0,
    IGNORED = 1,
    PERFORMED = 2,
    DISCARED = 3
}

interface CharacterAction {
    tag: string;
    code: CharacterActionCode;
}

class Character {
    body: DynamicBody;

    movement_speed: number;
    jump_force: number;
    jump_threshold: number;
    wallslide_affection: number;
    wallslide_speed: number;
    air_control_factor: number;
    run_movement_scale: number;
    run_vertical_jump_scale: number;
    run_horisontal_jump_scale: number;
    prerun_threshold: number;

    movement_x: number;
    moving_left: boolean;
    moving_right: boolean;
    sliding_wall: boolean;

    jumping_up: boolean;
    jumping_left: boolean;
    jumping_right: boolean;
    prerunning: boolean;
    running: boolean;
    jump_elapsed: number;
    run_elapsed: number;
    scene_collisions: SceneCollisions;
    look_direction_x: number;
    look_direction_y: number;

    collided_left: boolean;
    collided_right: boolean;
    collided_top: boolean;
    collided_bottom: boolean;

    phys_tick_elapsed: number;

    // actions that should be executed next step
    requested_actions: Array<CharacterAction>;
    // actions that was executed previous step
    performed_actions: Array<CharacterAction>;

    constructor(scene_collisions: SceneCollisions) {
        this.movement_speed = 2.7;
        this.jump_force = 5;
        this.jump_threshold = 0.1;
        this.wallslide_affection = 0.4;
        this.wallslide_speed = -1;
        this.air_control_factor = 0.4;
        this.run_vertical_jump_scale = 1.3;
        this.run_horisontal_jump_scale = 2;
        this.run_movement_scale = 1.5;
        this.prerun_threshold = 0.25;

        this.look_direction_x = 0;
        this.look_direction_y = 0;
        this.movement_x = 0;
        this.jump_elapsed = 0;
        this.run_elapsed = 0;
        this.moving_right = false;
        this.moving_left = false;
        this.jumping_left = false;
        this.jumping_right = false;
        this.jumping_up = false;
        this.running = false;
        this.prerunning = false;
        this.sliding_wall = false;
        this.requested_actions = [];
        this.performed_actions = [];
        this.scene_collisions = scene_collisions;
        this.collided_bottom = false;
        this.collided_left = false;
        this.collided_right = false;
        this.collided_top = false;
        this.phys_tick_elapsed = 0;
    }

    init(body: DynamicBody) : Character {
        this.body = body;

        return this;
    }

    step(dt: number, dr: number) {
        // zero-out step variables
        this.performed_actions.length = 0;
        this.jumping_left = this.jumping_right = this.jumping_up = false;

        this.updateCollideDirections();

        let perform_physics_actions = false;
        // predict physics tick frame
        if (this.scene_collisions.step_elapsed + dt >= this.scene_collisions.step_threshold) {
            this.phys_tick_elapsed = this.scene_collisions.step_number + 1;
            perform_physics_actions = true;
        }

        // apply actions
        // same type actions could be stacked but _action() functions shouldn't change state. only flags
        const actions_buff: Array<CharacterAction> = [];
        while(this.requested_actions.length) {
            const action = this.requested_actions.shift();
            if (!action) {
                break;
            }
            const code = this._action(action, perform_physics_actions);
            if (code == CharacterActionApplyCode.PERFORMED) {
                this.performed_actions.push(action)
            } else if (code == CharacterActionApplyCode.IGNORED) {
                // push unperformed actions back to queue
                actions_buff.push(action);
            } 
        }
        this.requested_actions = actions_buff;

        this._applyMovementForces(dt, dr, perform_physics_actions);

    }

    _applyMovementForces(dt: number, dr: number, physics_step: boolean) {
        let movement = 0;

        // movement direction & speed
        movement -= this.moving_left && !this.collided_left ? this.movement_speed : 0;
        movement += this.moving_right && !this.collided_right ? this.movement_speed : 0;

        // run state
        const discard_runstate_case0 = !this.prerunning || !movement || this.performed_actions.find((e) => e.tag == "move_left" || e.tag == "move_right");
        const discard_runstate_case1 = this.run_elapsed < this.prerun_threshold && !this.collided_bottom;
        if (discard_runstate_case0 || discard_runstate_case1) {
            this.run_elapsed = 0;
        } else {
            this.run_elapsed += dt;
        }

        this.running = this.run_elapsed >= this.prerun_threshold;
        const movement_scale = this.running ? this.run_movement_scale : 1;
        const vjump_scale = this.running ? this.run_vertical_jump_scale : 1;
        const hjump_scale = this.running ? this.run_horisontal_jump_scale : 1;

        // movement values calculate
        if (physics_step) {
            const m = movement * movement_scale
            // a. base lerp scales. Speed up/down
            const tacc = this.collided_bottom ? 0.8 : this.air_control_factor;
            const tdump = this.collided_bottom || this.collided_right || this.collided_left ? 0.95 : 0;
            let t = movement ? tacc : tdump;
            // c. Run control scale
            t *= this.running ? 0.5 : 1;
            this.movement_x = lerp(this.movement_x, m, t);
        }
        if (Math.abs(this.movement_x) < 1e-4) {
            this.movement_x = 0;
        }
        if(movement) {
            this.look_direction_x = Math.sign(movement);
        }


        // body velocity apply
        if (physics_step && this.jump_elapsed > this.jump_threshold) {
            this.body.velocity_x = lerp(this.body.velocity_x, this.movement_x, 0.7);
            if (Math.abs(this.body.velocity_x) < 1e-4) {
                this.body.velocity_x = 0;
            }
        }

        // jump
        if (physics_step && this.jump_elapsed > this.jump_threshold) {
            const jf = this.jump_force * vjump_scale;
            if (this.jumping_left || this.jumping_right || this.jumping_up) {
                this.jump_elapsed = 0;
            }
            //this.body.velocity_x = this.jumping_left ? this.jump_force : this.body.velocity_x;
            //this.body.velocity_x = this.jumping_right ? this.jump_force : this.body.velocity_x;

            if (this.jumping_up) {
                this.body.velocity_y = Math.min(jf * 1.5, this.body.velocity_y * 0.1 + jf);
            }
            /*
            if (this.jumping_left) {
                this.body.velocity_x = -jf * 0.15 * hjump_scale;
            } else if (this.jumping_right) {
                this.body.velocity_x = jf * 0.15 * hjump_scale;
            }*/
            //this.body.velocity_y = this.jumping_up ? Math.max(this.body.velocity_y, this.jump_force) : this.body.velocity_y;
        }
        this.jump_elapsed += dt;

        // wall glide

        this.sliding_wall = !this.collided_bottom && this.body.velocity_y <= 0 && ((this.collided_left && this.moving_left) || (this.collided_right && this.moving_right));
        if (physics_step && this.sliding_wall) {
            this.body.velocity_y = lerp(this.body.velocity_y, this.wallslide_speed, this.wallslide_affection);
        }
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
            this.jumping_right = !this.jumping_up && this.collided_left;
            this.jumping_left = !this.jumping_up && this.collided_right;
            this.jumping_up =  this.jumping_up || this.jumping_left || this.jumping_right;
        }

        return this.jumping_up || this.jumping_left || this.jumping_right;
    }

    private _action(action: CharacterAction, perform_physics_actions: boolean = false): CharacterActionApplyCode {
        let apply_code = CharacterActionApplyCode.DEFAULT;
        const tag = action.tag;
        const code = action.code;

        const physics_actions = ["jump", "move_left", "move_right", "run"];

        if (physics_actions.includes(tag) && !perform_physics_actions) {
            return CharacterActionApplyCode.IGNORED;
        }

        switch(tag) {
            case "jump":
                if (this._actiunJump()) {
                    apply_code = CharacterActionApplyCode.PERFORMED;
                } else {
                    apply_code = CharacterActionApplyCode.DISCARED;
                }
                break;
            case "run":
                apply_code = CharacterActionApplyCode.PERFORMED;
                this.prerunning = code == CharacterActionCode.START;
                break;
            case "hit":
                apply_code = CharacterActionApplyCode.PERFORMED;
                break;
            case "move_left":
                this.moving_left = code == CharacterActionCode.START;
                apply_code = CharacterActionApplyCode.PERFORMED;
                break;
            case "move_right":
                this.moving_right = code == CharacterActionCode.START;
                apply_code = CharacterActionApplyCode.PERFORMED;
                break;
            case "look_up":
                apply_code = CharacterActionApplyCode.PERFORMED;
                this.look_direction_y = code == CharacterActionCode.START ? 1 : 0;
                break;
            case "look_down":
                apply_code = CharacterActionApplyCode.PERFORMED;
                this.look_direction_y = code == CharacterActionCode.START ? -1 : 0;
                break;
            default:
                console.warn(`no action ${tag} defined`);
        }

        return apply_code;
    }

    actionRequest(tag: string, code: CharacterActionCode = 0) {
        if (!this.requested_actions.find((a) => { return a.tag == tag && a.code == code })) {
            this.requested_actions.push({tag, code});
        }
    }
}

export default Character;
export { Character, CharacterActionCode };