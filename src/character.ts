import { DynamicBody, SceneCollisions } from "./scene_collisions";
import { lerp, clamp } from "./math";
import GadgetGrapplingHook from "./gameplay/GadgetGrapplingHook";

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
    wallslide_friction: number;
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

    hook_speed: number;
    hook_length: number;
    hook_drag_force: number;

    gadget_grappling_hook: GadgetGrapplingHook;

    // actions that should be executed next step
    requested_actions: Array<CharacterAction>;
    // actions that was executed previous step
    performed_actions: Array<CharacterAction>;

    constructor(scene_collisions: SceneCollisions) {
        this.scene_collisions = scene_collisions;

        this.movement_speed = 2.7;
        this.jump_force = 5;
        this.jump_threshold = 0.1;
        this.wallslide_friction = 1;
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
        this.collided_bottom = false;
        this.collided_left = false;
        this.collided_right = false;
        this.collided_top = false;
        this.phys_tick_elapsed = 0;

        this.hook_length = 5;
        this.hook_speed = 50;
        this.hook_drag_force = 10;

        this.gadget_grappling_hook = new GadgetGrapplingHook(this.scene_collisions);
    }

    init(body: DynamicBody) : Character {
        this.body = body;
        this.gadget_grappling_hook.init(body);

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
        
        this.gadget_grappling_hook.step(dt);
        if (perform_physics_actions) {
            this._applyMovementForces(dt, dr);
        }

    }

    /**
     * Call only on physics step
     * @param dt 
     * @param dr 
     * @param physics_step 
     * @returns 
     */
    _applyMovementForces(dt: number, dr: number) {
        let limit_x = 0;
        let limit_y = 0;
        let acc_x = 0;
        let acc_y = 0;
        let movement = 0;

        // ---

        // movement direction & speed
        movement -= this.moving_left && !this.collided_left ? this.movement_speed : 0;
        movement += this.moving_right && !this.collided_right ? this.movement_speed : 0;

        // ---

        // a. horisontal movement
        acc_x += movement;

        // b. vertical movement (jump)
        const jumping = this._updateJumpState(dt);
        acc_y += jumping ? this.jump_force : 0;

        // c. run
        const running = this._updateRunState(dt, movement);
        acc_x *= running ? this.run_movement_scale : 1;
        acc_x *= running && jumping ? this.run_horisontal_jump_scale : 1;
        acc_y *= running ? this.run_vertical_jump_scale : 1;
        
        // d. wallslide (friction)
        this.sliding_wall = !this.collided_bottom && ((this.collided_left && this.moving_left) || (this.collided_right && this.moving_right));
        if (this.sliding_wall) {
            acc_y -= Math.min(0, this.body.velocity_y * this.wallslide_friction);
        }

        // e. hook. overrides all previous accelerations and velocity also
        if (this.gadget_grappling_hook.grapped) {
            const dx = (this.gadget_grappling_hook.pos_x - this.body.collider.x) * this.hook_drag_force; 
            const dy = (this.gadget_grappling_hook.pos_y - this.body.collider.y) * this.hook_drag_force; 
            acc_x = dx;
            acc_y = dy;
        }

        // ---
        const acc_x_mag = Math.abs(acc_x);
        const acc_y_mag = Math.abs(acc_y);

        // apply frictions/drags

        if (this.gadget_grappling_hook.grapped) {
            this.body.velocity_x = 0;
            this.body.velocity_y = 0;
        }

        // apply forces

        this.body.velocity_x = clamp(this.body.velocity_x + acc_x, -acc_x_mag, acc_x_mag);

        // not clamping min due gravity affection
        this.body.velocity_y = clamp(this.body.velocity_y + acc_y, -Infinity, this.jump_force * this.run_vertical_jump_scale);
        
        // set flag variables
        this.movement_x = movement;
        if(movement) {
            this.look_direction_x = Math.sign(movement);
        }
    }

    _updateRunState(dt: number, movemet_x: number): boolean {
        const discard_runstate_case0 = !this.prerunning || !movemet_x || this.performed_actions.find((e) => e.tag == "move_left" || e.tag == "move_right");
        const discard_runstate_case1 = this.run_elapsed < this.prerun_threshold && !this.collided_bottom;
        if (discard_runstate_case0 || discard_runstate_case1) {
            this.run_elapsed = 0;
        } else {
            this.run_elapsed += dt;
        }

        this.running = this.run_elapsed >= this.prerun_threshold;

        return this.running;
    }

    _updateJumpState(dt: number) {
        this.jump_elapsed += dt;

        if (this.jump_elapsed < this.jump_threshold) {
            return false;
        }

        if (this.jump_elapsed > this.jump_threshold) {
            if (this.jumping_left || this.jumping_right || this.jumping_up) {
                this.jump_elapsed = 0;
                
                return true;
            }
        }

        return false;
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
            case "hook":
                apply_code = CharacterActionApplyCode.PERFORMED;
                if (code == CharacterActionCode.START) {
                    const r = this.gadget_grappling_hook.shot(this.look_direction_y ? 0 : this.look_direction_x, this.look_direction_y, this.hook_length, this.hook_speed);
                    apply_code = r ? CharacterActionApplyCode.PERFORMED : CharacterActionApplyCode.DISCARED;
                } else {
                    this.gadget_grappling_hook.retract();
                }
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