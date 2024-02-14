import Events from "./events";
import { Character, CharacterAction, CharacterActionCode } from "./character";
import { SceneCollisions, BoxColliderC } from "./scene_collisions";
import { Box2, Vector2 } from "./lib/three.module";
import {
	addEventListener,
	removeEventListeners,
	EventListenerDetails,
} from "./document";
import CharacterRender from "./render/character_render";
import SceneRender from "./render/scene_render";
import { distlerp, lerp } from "./math";
import { SceneElement } from "./scene_edit";
import SceneDebug from "./scene_debug";
import { SceneCore, MapEntity, MapComponent } from "./scene_core";
import SceneMap from "./scene_map";
import SystemObjectsBreak from "./gameplay/SystemObjectsBreak";
import SystemObjectsFall from "./gameplay/SystemObjectsFall";

import SystemRenderBodiesPos from "./gameplay/SystemRenderBodiesPos";
import {
	AssetContentTypeComponent,
	AssetContentTypeGameprop,
	AssetContentTypeTrigger,
} from "./assets";
import { GameInputs, InputAction } from "./game_inputs";
import { MapEventCode } from "./systems";

export default class SceneGame {
	events: Events;
	inputs: GameInputs;
	player_character: Character;
	private player_character_render: CharacterRender;
	private scene_render: SceneRender;
	scene_collisions: SceneCollisions;
	scene_debug: SceneDebug;
	scene_core: SceneCore;
	scene_map: SceneMap;

	system_objects_break: SystemObjectsBreak;
	system_objects_fall: SystemObjectsFall;
	system_render_bodiespos: SystemRenderBodiesPos;

	attach_camera_to_player: boolean;
	camera_config: { attach_camera_z: number; attach_camera_y: number };

	private _listeners: Array<EventListenerDetails>;
	private active: boolean;
	private inplay: boolean;
	autostep: boolean;

	requested_map_switch: string | null;
	requested_map_entrance: string | null;

	gravity_x: number;
	gravity_y: number;

	constructor(
		scene_collisions: SceneCollisions,
		scene_render: SceneRender,
		scene_map: SceneMap,
		inputs: GameInputs
	) {
		this.events = new Events();
		this.inputs = inputs;
		this.scene_collisions = scene_collisions;
		this.scene_render = scene_render;
		this.scene_map = scene_map;
		this.scene_core = this.scene_map.scene_core;

		this.player_character_render = new CharacterRender();
		this.system_objects_break = new SystemObjectsBreak(this.scene_core);
		this.system_objects_fall = new SystemObjectsFall(
			this.scene_core,
			this.scene_render
		);
		this.system_render_bodiespos = new SystemRenderBodiesPos(
			this.scene_core,
			this.scene_render
		);

		this.active = false;
		this.inplay = false;
		this.autostep = true;
		this._listeners = [];
		this.requested_map_switch = null;
		this.requested_map_entrance = null;

		this.gravity_x = 0;
		this.gravity_y = -9.8;

		this.camera_config = {
			attach_camera_z: 7,
			attach_camera_y: 1,
		};
	}

	async init(): Promise<SceneGame> {
		this.player_character_render.init(this.scene_render, this.scene_collisions);
		this.attach_camera_to_player = false;
		await this.scene_collisions.init();
		this.scene_debug = new SceneDebug();

		this.inputs.events.on("action_start", (action: InputAction) => {
			this._action(action, CharacterActionCode.START);
		});
		this.inputs.events.on("action_end", (action: InputAction) => {
			this._action(action, CharacterActionCode.END);
		});

		return this;
	}

	async play(entrance_id?: string | null) {
		this.active = true;
		this.stopPlay();
		this.system_objects_break.run();
		this.system_objects_fall.run();
		this.system_render_bodiespos.run();

		this.requested_map_switch = null;
		this.requested_map_entrance = null;

		await this._runCharacter(entrance_id);

		addEventListener(
			{
				callback: () => {
					this.player_character.actionRequest(
						"move_left",
						CharacterActionCode.END
					);
					this.player_character.actionRequest(
						"move_right",
						CharacterActionCode.END
					);
				},
				name: "blur",
				node: window as any,
			},
			this._listeners
		);
		//addEventListener({callback: ()=> {console.log("focus")}, name: "focus", node: window as any}, this._listeners)

		// debug outputs -- {
		this.scene_debug.run(this.player_character, this.camera_config);
		this.scene_debug.camera_config_draw.addWrite(
			"camera_fov",
			() => this.scene_render.camera_base_fov,
			(v) => {
				this.scene_render.camera_base_fov = v;
				this.scene_render.updateCameraAspect();
			}
		);
		// debug outputs -- }

		this.inplay = true;
	}

	async _runCharacter(entrance_id?: string | null) {
		// find start pos
		const startpos = new Vector2(0.1, 4);
		{
			let entrance_found = false;
			for (const k in this.scene_core.components) {
				const el = this.scene_core.components[k];
				if (!entrance_id && el.type == "mapentry") {
					startpos.x = el.pos_x ?? 0;
					startpos.y = el.pos_y ?? 0;
					entrance_found = true;
				} else if (entrance_id && el.id === entrance_id) {
					startpos.x = el.pos_x ?? 0;
					startpos.y = el.pos_y ?? 0;
					entrance_found = true;
				}

				if (entrance_found) {
					break;
				}
			}

			if (entrance_id && !entrance_found) {
				console.warn(
					`SceneGame::run warn - entrance id set (${entrance_id}) but such element wasnt found`
				);
			}
		}

		// init player
		let playerbox = new Box2().setFromCenterAndSize(
			startpos,
			new Vector2(0.5, 0.6)
		);
		const body = this.scene_collisions.createBoxBody(
			"player_character",
			playerbox
		);
		this.player_character = new Character(this.scene_collisions).init(body);
		await this.player_character_render.run(this.player_character);

		// teleport it at start
		(this.player_character_render.character_scene as any).position.set(
			startpos.x,
			startpos.y,
			0
		);

		// teleport camera
		if (this.attach_camera_to_player) {
			const pos = this.scene_render.cache.vec3_0.set(
				startpos.x,
				startpos.y,
				10
			);
			this.scene_render.setPos(this.scene_render.camera, pos);
		}
	}

	stopPlay() {
		this.inplay = false;

		if (this.player_character) {
			this.player_character_render.stop();
			this.scene_collisions.removeBody(this.player_character.body.id, true);
		}
	}

	stop() {
		this.stopPlay();

		this.active = false;
		this.requested_map_switch = null;
		this.requested_map_entrance = null;
		this.scene_debug.stop();
		removeEventListeners(this._listeners);
	}

	/**
	 *
	 * @param dt
	 * @param dr
	 * @returns
	 */
	step(dt: number, forced: boolean = false) {
		if (!this.active) {
			return;
		}

		if (!this.inplay) {
			return;
		}
		if (!this.autostep && !forced) {
			return;
		}

		for (const k in this.scene_collisions.bodies) {
			const body = this.scene_collisions.bodies[k];
			body.velocity_y +=
				this.gravity_y * dt * this.scene_collisions.forces_scale;
		}

		if (!this.player_character.alive) {
			this.stopPlay();
			this.events.emit("gameover");
		}

		this.player_character.step(dt);
		this.scene_collisions.step(dt);
		this.player_character_render.step(dt);
		this.scene_debug.step();
		this.system_objects_fall.step(dt);
		this.system_render_bodiespos.step(dt);

		if (
			this.attach_camera_to_player &&
			this.player_character_render.character_scene
		) {
			const pos = this.scene_render.cache.vec3_0.copy(
				(this.player_character_render.character_scene as any).position
			);

			pos.z = this.camera_config.attach_camera_z;
			const lposx = (this.scene_render.camera as any).position.x;
			const lposy = (this.scene_render.camera as any).position.y;
			const shift_y = this.camera_config.attach_camera_y;
			const targ_y = pos.y + shift_y;
			pos.x = distlerp(lposx, pos.x, 0.4, 3);
			pos.y = distlerp(lposy, targ_y, 0.4, 3);

			//pos.y = lerp(pos.y, pos.y - this.player_character.look_direction_y * 2, 0.1);

			const targ = this.scene_render.cache.vec3_1.set(
				pos.x,
				targ_y - shift_y,
				pos.z - this.camera_config.attach_camera_z
			);
			this.scene_render.setCameraPos(pos, targ);
		}

		if (this.player_character.performed_actions.find((e) => e.tag == "hit")) {
			this._actionHit();
		}

		this.scene_map.setViewpoint(
			this.player_character.body.collider.x,
			this.player_character.body.collider.y
		);

		this._stepCharacterInteractions(this.player_character);
	}

	updateCharacterDamageConditions() {
		// crash by falling blocks
		if (
			this.player_character.collided_top &&
			this.player_character.collided_bottom
		) {
			const top_collider =
				this.scene_core.components[this.player_character.collided_top];
			const top_component = this.scene_core.components[top_collider.owner];
			const gameprop_id = top_component.get("gameprop");

			if (gameprop_id) {
				const gameprop = this.scene_core.matters.get(
					gameprop_id
				) as AssetContentTypeGameprop;

				if (gameprop.falling) {
					this.player_character.health = 0;
				}
			}
		}
	}

	private _stepCharacterInteractions(cha: Character) {
		let interacts = false;

		this.updateCharacterDamageConditions();

		const proceedCharacterInteraction = (trigger: AssetContentTypeTrigger) => {
			const action = this.player_character.performed_actions.find(
				(e) => e.tag == "look_up"
			);
			if (action) {
				// if trigger toggles it sends DEFAULT code
				// if trigger not toggling it sends START and END codes
				let code = MapEventCode.DEFAULT;
				if (!trigger.toggle) {
					// #mcd
					code =
						MapEventCode[
							CharacterActionCode[action.code] as keyof typeof MapEventCode
						];
				}

				if (
					code !== MapEventCode.DEFAULT ||
					action.code === CharacterActionCode.START
				) {
					this.scene_map.event({
						code,
						component: trigger.owner,
					});
				}

				if (
					action.code == CharacterActionCode.START &&
					trigger.event.includes("mapexit")
				) {
					const signal = trigger.event.split(",")[1];
					if (signal) {
						this.requestMapSwitch(signal);
					}
				}
			}
		};

		for (let i = 0; i < cha.body.contacts; i++) {
			const cid = cha.body.contacts_list[i].id;
			if (!cid) {
				continue;
			}
			const collider = this.scene_core.components[cid];
			const component = this.scene_core.components[collider?.owner];

			const trigger =
				component?.is_link("trigger") &&
				(this.scene_core.matters.get(
					component.get("trigger")
				) as AssetContentTypeTrigger);

			if (trigger) {
				interacts = trigger.user_interact;
				proceedCharacterInteraction(trigger);
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

	private _actionHit() {
		const hit_result = this.system_objects_break._actionHitCollisionTest(
			this.player_character,
			this.scene_collisions.colliders
		);
		if (!hit_result) {
			return;
		}

		const broke = this.system_objects_break.hit(hit_result);
		if (broke) {
			// component is collider. owner is actual block object
			const component = this.scene_core.matters.get(
				hit_result
			) as AssetContentTypeComponent;
			if (!component?.owner) {
				return;
			}
			// falling block activate
			this.system_objects_fall.touchFallingBlock(component.id);
			// remove breakable block

			const owner = this.scene_core.matters.get(component.owner);
			this.scene_core.remove(owner.id);

			// #debt-tilerefs: tileset creates two tile data object - one is persist tile reference, second one is actual tile instance
			// here tile ref marked as destroyed and it should not be restored
			if ((owner as any).tileref && owner.inherites) {
				const ref = this.scene_core.matters.get(owner.inherites) as any;
				ref.tiledestroyed = ref;
			}
		}
	}

	_action(act: InputAction, code: CharacterActionCode) {
		if (!this.inplay) {
			return;
		}

		switch (act) {
			case InputAction.left:
				this.player_character.actionRequest("move_left", code);
				break;
			case InputAction.up:
				this.player_character.actionRequest("look_up", code);
				break;
			case InputAction.right:
				this.player_character.actionRequest("move_right", code);
				break;
			case InputAction.down:
				this.player_character.actionRequest("look_down", code);
				break;
			case InputAction.acion_a:
				this.player_character.actionRequest("jump", code);
				break;
			case InputAction.acion_b:
				this.player_character.actionRequest("hit", code);
				break;
			case InputAction.acion_c:
				this.player_character.actionRequest("hook", code);
				break;
			case InputAction.acion_d:
				if (code == CharacterActionCode.START) {
					this.step(0.016, true);
				}
				break;
		}
	}
}
