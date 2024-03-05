import * as THREE from '../lib/three.module.js';
import Character from "./character.js";
import SceneRender from "../render/scene_render.js";
import { SceneCollisions } from '../app/scene_collisions.js';
import { lerp, distlerp } from '../core/math.js';
import { AnimationNode, Animator, AnimationMachine, AnimationTransitionMode } from "../render/animator";

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
			const register = (name: string, clipname: string) => {
				const clip = this.animator.getAnimation(clipname);
				if (!clip) {
					throw new Error(`Animator::register error - no clip "${clipname}" found`);
				}
				const node = new AnimationNode(name, clip);
				am.register(node);
			}

			register("idle", "idle");
			register("run", "run");
			register("hit", "hit");
			register("jump", "jump-1");
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
			am.pair("jump", "lean");
			am.pair("fall", "lean");

			am.pair("lean", "fall");
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

        this.character_gltf = await this.scene_render.addGLTF("res/test-cha.glb", "player_character");
        this.character_scene = this.character_gltf.scene;
        this.character_scene.children[0].position.y = -0.5;

        (this.character_scene as any).scale.set(0.5, 0.5, 0.5);
        this.current_animation_name = null;
        this.character_x_rot = 0;

				this.animator.init(this.character_scene, this.character_gltf);
				this._initAnimationMachine();

        this.ui_interact_sprite = await this.scene_render.makeSprite("keyboard_arrows_up_outline");
        (this.ui_interact_sprite as any).position.y = 1.5;
        this.character_scene.add(this.ui_interact_sprite);
        this.character_scene.visible = this.draw_character_mesh;

				const body = this.character.body;
				if (this.draw_bodypos_path) {
					for(let i = 0; i < 10; i++) {
						const sphere = this.scene_render.testSphereAdd(this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0), 0.01);
						this.debug_bodypos_path.push(sphere);
					}
					this.debug_bodypos1 = this.scene_render.testSphereAdd(this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0), 0.03, 0xff0000);
					this.debug_bodypos2 = this.scene_render.testSphereAdd(this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0), 0.05, 0x0000ff);
				}

        this.hook_draw = this.scene_render.testSphereAdd(this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0), 0.05, 0xff0000);
    }

    stop() {
        this.scene_render.removeGLTF("player_character");
        while(this.debug_bodypos_path.length) {
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
                this.scene_render.setPos(this.hook_draw, this.scene_render.cache.vec3_0.set(this.character.gadget_grappling_hook.pos_x, this.character.gadget_grappling_hook.pos_y, 0))
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

				if(this.character.performed_actions.find((e) => e.tag == "hit")) {
					this.animator.transite("hit");
				} else if (this.character.collided_bottom && this.character.movement_x) {
					this.animator.transite("run");
        } else if (this.character.collided_bottom && !this.character.movement_x) {
					this.animator.transite("idle");
        } else if (!this.character.collided_bottom && (this.character.collided_right || this.character.collided_left)) {
					this.animator.transite("lean");
				}
				else if (!this.character.collided_bottom) {
					this.animator.transite("fall");
				} 

				/*
        if (this.character.performed_actions.find((e) => e.tag == "jump")) {
            this.playAnimation("jump-1", { once: true, weight: 0.9, speed: 1.5 });
						this.synchronizeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("fall-idle"), 0.1);
        } else if(this.character.performed_actions.find((e) => e.tag == "hit")) {
            this.playAnimation("hit", { once: true, weight: 0.9, speed: 2 });
        } else if (this.character.collided_bottom && this.character.movement_x && this.current_animation_name != "run") {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("run"), 0.1);
        } else if (this.character.collided_bottom && !this.character.movement_x && this.character.body.velocity_y <= 0) {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("Idle"), 0.8);
        }
			 */
    }

    renderCharacterModel(dt: number) {
        const cha = this.character_scene as any;
        const body = this.character.body;

        if (!this.character.collided_bottom && (this.character.collided_right || this.character.collided_left)) {
					const dir = this.character.collided_left ? 1 : -1;
					this.character_x_rot = lerp(this.character_x_rot, dir, 0.5) ;
				} else {
					this.character_x_rot = lerp(this.character_x_rot, this.character.look_direction_x, 0.2) ;
				}

        cha.lookAt(this.scene_render.cache.vec3_0.set((cha as any).position.x + this.character_x_rot, (cha as any).position.y + this.character.look_direction_y * 0.3,  1 - Math.abs(this.character_x_rot)));
    }
}
