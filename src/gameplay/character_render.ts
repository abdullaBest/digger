import * as THREE from "../lib/three.module.js";
import Character from "./character.js";
import SceneRender from "../render/scene_render.js";
import { SceneCollisions } from "../app/scene_collisions.js";
import { lerp, distlerp } from "../core/math.js";
import {
	AnimationNode,
	Animator,
	AnimationMachine,
	AnimationTransitionMode,
	AnimationPlaybackMode,
} from "../render/animator";

export default class CharacterRender {
	character: Character;
	scene_render: SceneRender;
	character_gltf: any;
	character_scene: THREE.Object3D;
	colliders: SceneCollisions;
	animator: Animator;

	current_animation_name: string | null;
	character_x_rot: number;

	debug_bodypos_path: Array<THREE.Mesh>;
	debug_bodypos1: THREE.Mesh | null;
	debug_bodypos2: THREE.Mesh | null;

	draw_character_mesh: boolean;
	draw_bodypos_path: boolean;

	hook_draw: THREE.Mesh;

	ui_interact_sprite: THREE.Sprite | null;

	lights: THREE.Group;

	init(scene_render: SceneRender, colliders: SceneCollisions) {
		this.scene_render = scene_render;
		this.colliders = colliders;
		this.debug_bodypos_path = [];
		this.draw_character_mesh = true;
		this.draw_bodypos_path = false;
		this.animator = new Animator();
	}

	_initAnimationMachine() {
		const am = this.animator.animation_machine;
		const register = (
			name: string,
			clipname: string,
			{ playback_mode = AnimationPlaybackMode.default, speed = 1 } = {}
		) => {
			const clip = this.animator.getAnimation(clipname);
			if (!clip) {
				throw new Error(
					`Animator::register error - no clip "${clipname}" found`
				);
			}
			const node = new AnimationNode(name, clip);
			node.playback_mode = playback_mode;
			clip.setEffectiveTimeScale(speed);
			am.register(node);
		};

		register("idle", "idle");
		register("run", "run");
		register("hit", "hit", {
			speed: 2,
			playback_mode: AnimationPlaybackMode.at_start,
		});
		register("jump", "jump-1", {
			playback_mode: AnimationPlaybackMode.at_start,
		});
		register("fall", "fall-idle");
		register("lean", "lean");

		am.pair("idle", "run");
		am.pair("run", "idle");

		am.pair("idle", "jump");
		am.pair("run", "jump");
		am.pair("jump", "idle");
		am.pair("jump", "run");
		am.pair("jump", "fall");
		am.pair("fall", "idle");
		am.pair("fall", "run");
		am.pair("jump", "lean", AnimationTransitionMode.end);
		am.pair("fall", "lean");

		am.pair("lean", "fall");
		am.pair("lean", "jump");
		am.pair("lean", "idle");
		am.pair("lean", "run");

		am.pair("idle", "hit");
		am.pair("run", "hit");
		am.pair("hit", "idle", AnimationTransitionMode.end);
		am.pair("hit", "run");
		am.pair("hit", "jump");

		/*
			am.pair("idle", "hit");
		 */
	}

	async run(character: Character) {
		this.character = character;

		this.character_gltf = await this.scene_render.addGLTF(
			"res/test-cha.glb",
			"player_character"
		);
		this.character_scene = this.character_gltf.scene;
		this.character_scene.children[0].position.y = -0.55;
		this.character_scene.traverse((o) => {
			if (!o.isMesh) {
				return;
			}

			o.castShadow = true;
		});

		if (!this.lights) {
			this.lights = new THREE.Group();
			const plight = new THREE.PointLight(0xffffdd, 0.1, 10);
			//plight.castShadow = true;
			plight.position.z = -1;
			plight.position.y = 0.5;
			this.lights.add(plight);
			const spotLight = new THREE.SpotLight(0xffffff, 10, 10, 0.5, 0.7);
			this.scene_render.loader.loadTexture("res/noise-texture.png", "noise-texture").then((texture) => {
				spotLight.map = texture;
			});
			spotLight.castShadow = true;
			spotLight.position.z = 5;
			(this.lights as any).spotLight = spotLight;
			this.lights.add(spotLight);

			this.scene_render.scene.add(this.lights);
		}
		(this.lights as any).spotLight.target = this.character_scene;

		(this.character_scene as any).scale.set(0.5, 0.5, 0.5);
		this.current_animation_name = null;
		this.character_x_rot = 0;

		this.animator.init(this.character_scene, this.character_gltf);
		this._initAnimationMachine();

		this.ui_interact_sprite = await this.scene_render.makeSprite(
			"keyboard_arrows_up_outline"
		);
		(this.ui_interact_sprite as any).position.y = 1.5;
		this.character_scene.add(this.ui_interact_sprite);
		this.character_scene.visible = this.draw_character_mesh;

		const body = this.character.body;
		if (this.draw_bodypos_path) {
			for (let i = 0; i < 10; i++) {
				const sphere = this.scene_render.testSphereAdd(
					this.scene_render.cache.vec3_0.set(
						body.collider.x,
						body.collider.y,
						0
					),
					0.01
				);
				this.debug_bodypos_path.push(sphere);
			}
			this.debug_bodypos1 = this.scene_render.testSphereAdd(
				this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0),
				0.03,
				0xff0000
			);
			this.debug_bodypos2 = this.scene_render.testSphereAdd(
				this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0),
				0.05,
				0x0000ff
			);
		}

		this.hook_draw = this.scene_render.testSphereAdd(
			this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0),
			0.05,
			0xff0000
		);
	}

	stop() {
		this.scene_render.removeGLTF("player_character");
		while (this.debug_bodypos_path.length) {
			const m = this.debug_bodypos_path.pop();
			if (m) {
				m.removeFromParent();
			}
		}
		if (this.debug_bodypos1) {
			this.debug_bodypos1.removeFromParent();
			this.debug_bodypos1 = null;
		}
		if (this.debug_bodypos2) {
			this.debug_bodypos2.removeFromParent();
			this.debug_bodypos2 = null;
		}
	}

	step(dt: number) {
		const gltf = this.character_gltf;
		// character still loads
		if (!gltf) {
			return;
		}

		this.updateCharacterAnimations();
		this.renderCharacterModel(dt);

		// hook animation
		if (this.hook_draw) {
			this.hook_draw.visible = this.character.gadget_grappling_hook.elapsed > 0;
			if (this.character.gadget_grappling_hook.elapsed > 0) {
				this.scene_render.setPos(
					this.hook_draw,
					this.scene_render.cache.vec3_0.set(
						this.character.gadget_grappling_hook.pos_x,
						this.character.gadget_grappling_hook.pos_y,
						0
					)
				);
			}
		}

		this.animator.step(dt);
	}

	drawUiInteractSprite(show: boolean) {
		if (this.ui_interact_sprite) {
			this.ui_interact_sprite.visible = show;
		}
	}

	updateCharacterAnimations() {
		if (!this.draw_character_mesh) {
			return;
		}

		const cha = this.character;

		if (cha.performed_actions.find((e) => e.tag == "hit")) {
			this.animator.transite("hit");
		} else if (cha.collided_bottom && cha.movement_x) {
			this.animator.transite("run");
		} else if (cha.collided_bottom && !cha.movement_x) {
			this.animator.transite("idle");
		} else if (
			!cha.collided_bottom &&
			cha.performed_actions.find((e) => e.tag == "jump")
		) {
			this.animator.transite("jump");
		} else if (
			!cha.collided_bottom &&
			(cha.collided_right || cha.collided_left)
		) {
			this.animator.transite("lean");
		} else if (!cha.collided_bottom) {
			this.animator.transite("fall");
		}
	}

	renderCharacterModel(dt: number) {
		const cha = this.character_scene as any;
		const body = this.character.body;

		if (
			!this.character.collided_bottom &&
			(this.character.collided_right || this.character.collided_left)
		) {
			const dir = this.character.collided_left ? 1 : -1;
			// face out of wall
			this.character_x_rot = lerp(this.character_x_rot, dir, 0.5);
			// fix lean model distance
			this.character_scene.children[0].position.z = -0.2;
		} else {
			this.character_x_rot = lerp(
				this.character_x_rot,
				this.character.look_direction_x,
				0.2
			);
			this.character_scene.children[0].position.z = 0;
		}

		cha.lookAt(
			this.scene_render.cache.vec3_0.set(
				(cha as any).position.x + this.character_x_rot,
				(cha as any).position.y + this.character.look_direction_y * 0.3,
				1 - Math.abs(this.character_x_rot)
			)
		);

		this.lights.position.x = this.character_scene.position.x;
		this.lights.position.y = this.character_scene.position.y;
	}
}
