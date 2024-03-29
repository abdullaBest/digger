import {
	BoxColliderC,
	DynamicBody,
	SceneCollisions,
} from "../app/scene_collisions";
import { lerp, clamp } from "../core/math";
import GadgetGrapplingHook from "./gadget_grapplig_hook";
import GadgetTorch from "./gadget_torch";

enum CharacterActionCode {
	DEFAULT = 0,
	START = 1,
	END = 2,
}

enum CharacterActionApplyCode {
	DEFAULT = 0,
	IGNORED = 1,
	PERFORMED = 2,
	DISCARED = 3,
}

enum CharacterToolModes {
	DEFAULT = 0,
	SUPERAXE = 1,
	__LENGTH,
}

interface CharacterAction {
	tag: string;
	code: CharacterActionCode;
}

class Character {
	body: DynamicBody;

	health: number;

	body_mass: number;
	body_drag: number;
	ground_friction: number;
	movement_speed: number;
	movement_acceleration: number;
	jump_force: number;
	jump_threshold: number;
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
	jumping_air: boolean;

	prerunning: boolean;
	running: boolean;
	jump_elapsed: number;
	run_elapsed: number;
	airtime_elapsed: number;
	airjump_threshold: number;
	scene_collisions: SceneCollisions;
	look_direction_x: number;
	look_direction_y: number;

	collided_left: string | null;
	collided_right: string | null;
	collided_top: string | null;
	collided_bottom: string | null;

	hit_elapsed: number;
	hit_threshold: number;
	hit_delay: number;
	hit_delayed: boolean;

	damage_threshold: number;
	damage_elapsed: number;

	phys_tick_elapsed: number;

	hook_speed: number;
	hook_length: number;
	hook_drag_force: number;

	gadget_grappling_hook: GadgetGrapplingHook;
	gadget_torch: GadgetTorch;

	tool_mode: CharacterToolModes;

	// actions that should be executed next step
	requested_actions: Array<CharacterAction>;
	// actions that was executed previous step
	performed_actions: Array<CharacterAction>;

	constructor(scene_collisions: SceneCollisions) {
		this.scene_collisions = scene_collisions;
		this.health = 1;

		this.body_mass = 42;
		this.body_drag = 0.001;
		this.ground_friction = 0.5;
		this.movement_speed = 2.4;
		this.movement_acceleration = 10;
		this.jump_force = 160;
		this.jump_threshold = 0.1;
		this.wallslide_speed = 1;
		this.air_control_factor = 0.8;
		this.run_vertical_jump_scale = 1.3;
		this.run_horisontal_jump_scale = 1.2;
		this.run_movement_scale = 1.5;
		this.prerun_threshold = 0.15;
		this.airjump_threshold = 0.1;

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
		this.jumping_air = false;
		this.running = false;
		this.prerunning = false;
		this.sliding_wall = false;
		this.requested_actions = [];
		this.performed_actions = [];
		this.collided_bottom = null;
		this.collided_left = null;
		this.collided_right = null;
		this.collided_top = null;
		this.phys_tick_elapsed = 0;
		this.airtime_elapsed = 0;
		this.hit_delay = 0.1;
		this.hit_threshold = 0.2;
		this.hit_elapsed = 0;
		this.hit_delayed = false;

		this.hook_length = 5;
		this.hook_speed = 50;
		this.hook_drag_force = 8;

		this.damage_threshold = 0.5;
		this.damage_elapsed = 0;

		this.gadget_grappling_hook = new GadgetGrapplingHook(this.scene_collisions);
		this.gadget_torch = new GadgetTorch();

		this.tool_mode = CharacterToolModes.DEFAULT;
	}

	init(body: DynamicBody): Character {
		this.body = body;
		this.body.mass = this.body_mass;
		this.body.drag = this.body_drag;
		this.gadget_grappling_hook.init(body);
		this.gadget_torch.init();

		return this;
	}

	step(dt: number) {
		// zero-out step variables
		this.performed_actions.length = 0;
		this.jumping_left = this.jumping_right = this.jumping_up = false;

		this.updateCollideDirections();

		let perform_physics_actions = false;
		// predict physics tick frame
		if (
			this.scene_collisions.step_elapsed + dt >=
			this.scene_collisions.step_threshold
		) {
			this.phys_tick_elapsed = this.scene_collisions.step_number + 1;
			perform_physics_actions = true;
		}

		this.damage_elapsed += dt;
		this._updateHitState(dt);

		// apply actions
		// same actions types could be stacked but _action() functions shouldn't change state. only flags
		const actions_buff: Array<CharacterAction> = [];
		while (this.requested_actions.length) {
			const action = this.requested_actions.shift();
			if (!action) {
				break;
			}
			const code = this._action(action, perform_physics_actions);
			if (code == CharacterActionApplyCode.PERFORMED) {
				this.performed_actions.push(action);
			} else if (code == CharacterActionApplyCode.IGNORED) {
				// push unperformed actions back to queue
				actions_buff.push(action);
			}
		}
		this.requested_actions = actions_buff;

		this.gadget_grappling_hook.step(dt);
		this.gadget_torch.step(dt);
		this._applyMovementForces(dt, perform_physics_actions);
	}

	get alive(): boolean {
		return this.health > 0;
	}

	get damaged(): boolean {
		return this.damage_elapsed < this.damage_threshold;
	}

	damage(amount: number) {
		if (this.damaged) {
			return;
		}

		this.health -= amount;
		this.damage_elapsed = 0;
	}

	/**
	 * Call only on physics step
	 * @param dt
	 * @param dr
	 * @param physics_step
	 * @returns
	 */
	_applyMovementForces(dt: number, physics_step: boolean) {
		let acc_x = 0;
		let acc_y = 0;
		let movement_x = 0;
		let movement_y = 0;

		// ---

		// movement direction & speed
		movement_x -=
			this.moving_left && !this.is_collided_left()
				? this.movement_acceleration
				: 0;
		movement_x +=
			this.moving_right && !this.is_collided_right()
				? this.movement_acceleration
				: 0;

		if (!this.is_collided_bottom()) {
			movement_x *= this.air_control_factor;
		}

		const jumping = this._updateJumpState(dt);
		const running = this._updateRunState(dt, movement_x);

		if (!physics_step) {
			return;
		}

		// ---

		// a. horisontal movement
		const run_timing_scale_factor = 2.5;
		const run_scale = lerp(
			1,
			this.run_movement_scale,
			Math.min(1, this.run_elapsed * run_timing_scale_factor)
		);
		if (this.running) {
			// full speed reached after (run_elapsed / factor) seconds
			movement_x *= run_scale;
			movement_x *= jumping ? this.run_horisontal_jump_scale : 1;
		}

		/*
		// smooth
		movement_x = lerp(this.movement_x, movement_x, movement_x ? 0.6 : 0.95);
		if (Math.abs(movement_x) < 1e-2) {
			movement_x = 0;
		}
	 */

		if (movement_x) {
			acc_x += movement_x;
		}

		// b. vertical movement (jump)
		movement_y += jumping ? this.jump_force : 0;
		movement_y *= running ? this.run_vertical_jump_scale : 1;

		if (movement_y) {
			const add = this.jumping_air
				? this.body.velocity_y
				: Math.max(0, this.body.velocity_y);
			acc_y += movement_y - add;
		}

		// d. wallslide (friction)
		this.sliding_wall =
			!this.is_collided_bottom() &&
			((this.is_collided_left() && this.moving_left) ||
				(this.is_collided_right() && this.moving_right));

		// e. hook. overrides all previous accelerations
		if (this.gadget_grappling_hook.grapped) {
			const threshold = 1e-2;
			const dist_x =
				Math.abs(this.gadget_grappling_hook.pos_x - this.body.collider.x) -
				this.body.collider.width * 0.5;
			const dist_y =
				Math.abs(this.gadget_grappling_hook.pos_y - this.body.collider.y) -
				this.body.collider.height * 0.5;
			const sdx = dist_x > threshold ? this.gadget_grappling_hook.dir_x : 0;
			const sdy = dist_y > threshold ? this.gadget_grappling_hook.dir_y : 0;

			/*
			const sdx = clamp(
				this.gadget_grappling_hook.pos_x -
					this.body.collider.x -
					(this.body.collider.width / 2) * this.gadget_grappling_hook.dir_x,
				-1,
				1
			);
			const sdy = clamp(
				this.gadget_grappling_hook.pos_y -
					this.body.collider.y -
					(this.body.collider.height / 2) * this.gadget_grappling_hook.dir_y,
				-1,
				1
			);
		 */
			const dx = sdx * this.hook_drag_force;
			const dy = sdy * this.hook_drag_force;
			acc_x = dx;
			acc_y = dy;

			// fixin obstacle stuck
			// vertical movement
			const obstacle_top =
				dy > 1 && this.collided_top && this.gadget_grappling_hook.dir_y > 0;
			const obstacle_bottom =
				dy < -1 && this.collided_bottom && this.gadget_grappling_hook.dir_y < 0;
			let obstacle_y: null | BoxColliderC = null;
			if (obstacle_top && this.collided_top) {
				obstacle_y = this.scene_collisions.colliders[this.collided_top];
			} else if (obstacle_bottom && this.collided_bottom) {
				obstacle_y = this.scene_collisions.colliders[this.collided_bottom];
			}

			if (obstacle_y) {
				const dx =
					this.body.collider.x - obstacle_y.x > 0
						? obstacle_y._right - this.body.collider._left
						: obstacle_y._left - this.body.collider._right;
				acc_x += dx * 10;
			}

			// fixin obstacle stuck
			// horisontal movement
			const obstacle_right =
				dx > 1 && this.collided_right && this.gadget_grappling_hook.dir_x > 0;
			const obstacle_left =
				dx < -1 && this.collided_left && this.gadget_grappling_hook.dir_x < 0;
			let obstacle_x: null | BoxColliderC = null;
			if (obstacle_right && this.collided_right) {
				obstacle_x = this.scene_collisions.colliders[this.collided_right];
			} else if (obstacle_left && this.collided_left) {
				obstacle_x = this.scene_collisions.colliders[this.collided_left];
			}

			if (obstacle_x) {
				const dy =
					this.body.collider.y - obstacle_x.y > 0
						? obstacle_x._top - this.body.collider._bottom
						: obstacle_x._bottom - this.body.collider._top;
				acc_y += dy * 10;
			}
		}

		// ---

		// apply frictions/drags

		// a. grapple. completele disable all velocities
		if (this.gadget_grappling_hook.grapped) {
			acc_x *= this.body.mass;
			acc_y *= this.body.mass;
			this.body.velocity_x = 0;
			this.body.velocity_y = 0;
			this.body.drag = 0;
		} else {
			this.body.drag = this.body_drag;
		}

		// b. wallslide. clamps negative y velocity
		if (this.sliding_wall) {
			this.body.velocity_y = clamp(
				this.body.velocity_y,
				-this.wallslide_speed,
				Infinity
			);
		}

		// c. ground friction
		if (
			(!movement_x ||
				Math.sign(movement_x) !== Math.sign(this.body.velocity_x)) &&
			this.is_collided_bottom()
		) {
			acc_x -= this.body.velocity_x * this.body.mass * this.ground_friction;
		}

		// d. apply forces
		acc_x /= this.body.mass;
		acc_y /= this.body.mass;

		this.body.velocity_x += acc_x;
		this.body.velocity_y += acc_y;

		// clamp
		const hlimit =
			this.movement_speed * run_scale;
		this.body.velocity_x = clamp(this.body.velocity_x, -hlimit, hlimit);
		this.body.velocity_y = clamp(
			this.body.velocity_y,
			-Infinity,
			this.movement_speed * 1.5
		);

		// set flag variables
		this.movement_x = movement_x;
		if (movement_x) {
			this.look_direction_x = Math.sign(movement_x);
		}
	}

	_updateHitState(dt: number) {
		this.hit_elapsed += dt;

		if (this.hit_delayed && this.hit_elapsed >= this.hit_delay) {
			this.hit_delayed = false;

			const action = {
				tag: "hit_made",
				code: CharacterActionCode.DEFAULT,
			};
			this.performed_actions.push(action);
		}
	}

	_updateRunState(dt: number, movement_x: number): boolean {
		const discard_runstate_case0 =
			!this.prerunning ||
			!movement_x ||
			this.performed_actions.find(
				(e) => e.tag == "move_left" || e.tag == "move_right"
			);
		const discard_runstate_case1 =
			this.run_elapsed < this.prerun_threshold && !this.is_collided_bottom();
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

		if (!this.is_collided_bottom()) {
			this.airtime_elapsed += dt;
		} else {
			this.airtime_elapsed = 0;
		}

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
		this.collided_left = null;
		this.collided_right = null;
		this.collided_bottom = null;
		this.collided_top = null;

		for (let i = 0; i < this.body.contacts; i++) {
			const c = this.body.contacts_list[i];
			if (!c.normal_x && !c.normal_y) {
				continue;
			}
			if (c.normal_y == -1) {
				this.collided_bottom = c.id;
			} else if (c.normal_y == 1) {
				this.collided_top = c.id;
			} else if (c.normal_x == -1) {
				this.collided_left = c.id;
			} else if (c.normal_x == 1) {
				this.collided_right = c.id;
			}
		}
	}

	private _actiunJump(): boolean {
		const freejump = false;

		if (freejump) {
			this.jumping_up = true;
		} else {
			// floor jump
			const airjump_allowed = this.airtime_elapsed < this.airjump_threshold;
			this.jumping_up = this.is_collided_bottom() || airjump_allowed;
			this.jumping_air = !this.is_collided_bottom() && airjump_allowed;

			// wall jump
			this.jumping_right = !this.jumping_up && this.is_collided_left();
			this.jumping_left = !this.jumping_up && this.is_collided_right();
			this.jumping_up =
				this.jumping_up || this.jumping_left || this.jumping_right;
		}

		return this.jumping_up || this.jumping_left || this.jumping_right;
	}

	private _actionHit(): boolean {
		// only hits on ground
		if (!this.collided_bottom) {
			return false;
		}

		// can't hit too often
		if (this.hit_elapsed < this.hit_threshold) {
			return false;
		}

		// hit action already delayed and will be executed anyway
		if (this.hit_elapsed < this.hit_delay) {
			return false;
		}

		this.hit_elapsed = 0;
		this.hit_delayed = true;

		return true;
	}

	private _action(
		action: CharacterAction,
		perform_physics_actions: boolean = false
	): CharacterActionApplyCode {
		let apply_code = CharacterActionApplyCode.DEFAULT;
		const tag = action.tag;
		const code = action.code;

		const physics_actions = ["jump", "move_left", "move_right", "run"];

		if (physics_actions.includes(tag) && !perform_physics_actions) {
			return CharacterActionApplyCode.IGNORED;
		}

		switch (tag) {
			case "jump":
				if (code == CharacterActionCode.START) {
					if (this._actiunJump()) {
						apply_code = CharacterActionApplyCode.PERFORMED;
					} else {
						apply_code = CharacterActionApplyCode.DISCARED;
					}
				}
				break;
			case "run":
				apply_code = CharacterActionApplyCode.PERFORMED;
				this.prerunning = code == CharacterActionCode.START;
				break;
			case "hit":
				if (code == CharacterActionCode.START) {
					if (this._actionHit()) {
						apply_code = CharacterActionApplyCode.PERFORMED;
					} else {
						apply_code = CharacterActionApplyCode.DISCARED;
					}
				}
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
					const r = this.gadget_grappling_hook.shot(
						this.look_direction_y ? 0 : this.look_direction_x,
						this.look_direction_y,
						this.hook_length,
						this.hook_speed
					);
					apply_code = r
						? CharacterActionApplyCode.PERFORMED
						: CharacterActionApplyCode.DISCARED;
				} else {
					this.gadget_grappling_hook.retract();
				}
				break;
			case "switch":
				if (code == CharacterActionCode.START) {
					const newmode =
						CharacterToolModes[
							CharacterToolModes[
								(this.tool_mode + 1) % CharacterToolModes.__LENGTH
							]
						];
					this.tool_mode = newmode;
				}
				break;
			default:
				console.warn(`no action ${tag} defined`);
		}

		return apply_code;
	}

	actionRequest(tag: string, code: CharacterActionCode = 0) {
		if (
			!this.requested_actions.find((a) => {
				return a.tag == tag && a.code == code;
			})
		) {
			this.requested_actions.push({ tag, code });
		}
	}

	is_collided_left() {
		return this.collided_left !== null;
	}

	is_collided_right() {
		return this.collided_right !== null;
	}

	is_collided_bottom() {
		return this.collided_bottom !== null;
	}

	is_collided_top() {
		return this.collided_top !== null;
	}
}

export default Character;
export { Character, CharacterAction, CharacterActionCode, CharacterToolModes };
