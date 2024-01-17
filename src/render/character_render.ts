import * as THREE from '../lib/three.module.js';
import Character from "../character.js";
import SceneRender from "./scene_render";
import { SceneCollisions } from '../scene_collisions.js';
import { lerp, distlerp } from '../math.js';

export default class CharacterRender {
    character: Character;
    scene_render: SceneRender;
    character_gltf: any;
    character_scene: THREE.Object3D;
    colliders: SceneCollisions;
    animation_mixer: THREE.AnimationMixer;
    animation_time_scale: number;

    current_animation_name: string | null;
    animations_actions_cache: {[id: string] : THREE.AnimationAction};
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
        this.animation_time_scale = 1;
        this.debug_bodypos_path = [];
        this.draw_character_mesh = true;
        this.draw_bodypos_path = false;
    }

    async run(character: Character) {
        this.character = character;

        this.character_gltf = await this.scene_render.addGLTF("res/test-cha.glb", "player_character");
        this.character_scene = this.character_gltf.scene;
        this.character_scene.children[0].position.y = -0.5;

        (this.character_scene as any).scale.set(0.5, 0.5, 0.5);
        this.animation_mixer = new THREE.AnimationMixer(this.character_scene);
        this.animations_actions_cache = {};
        this.current_animation_name = null;
        this.character_x_rot = 0;

        this.ui_interact_sprite = await this.scene_render.makeSprite("DPAD_up");
        (this.ui_interact_sprite as any).position.y = 2.5;
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
        this.scene_render.removeModel("player_character");
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
       
        if (this.animation_mixer) {
            this.animation_mixer.update(dt * this.animation_time_scale);
        }
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

        if(this.character.performed_actions.find((e) => e.tag == "jump")) {
            this.playAnimation("jump-1", { once: true, weight: 0.9, speed: 1.5 });
        } else if(this.character.performed_actions.find((e) => e.tag == "hit")) {
            this.playAnimation("hit", { once: true, weight: 0.9, speed: 2 });
        } else if (this.character.movement_x && this.current_animation_name != "run") {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("run"), 0.1);
        } else if (!this.character.movement_x) {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("Idle"), 0.8);
        }
    }

    renderCharacterModel(dt: number) {
        const cha = this.character_scene as any;
        const body = this.character.body;

        this.character_x_rot = lerp(this.character_x_rot, this.character.look_direction_x, 0.2) ;
        cha.lookAt(this.scene_render.cache.vec3_0.set((cha as any).position.x + this.character_x_rot, (cha as any).position.y + this.character.look_direction_y * 0.3,  1 - Math.abs(this.character_x_rot)));
    }

    getAnimation(name: string | null, gltf = this.character_gltf) : THREE.AnimationAction | null {
        if (!name) {
            return null;
        }

        if (!this.animation_mixer) {
            throw new Error("CharacterRender::playAnimation error - No animation mixer set");
        }

        let action = this.animations_actions_cache[name] ?? this.animation_mixer.clipAction(THREE.AnimationClip.findByName(gltf, name));
        if (!action) {
            return null;
        }
        this.animations_actions_cache[name] = action;
        action.play();
        this.setWeight(action, 0);
        return action;
        //this.current_animation_name = action.getClip().name;
    }

    playAnimation(
        name: string,  
        { once = false, weight = 1, fadeout = 0.1, fadein = 0.1, speed = 1 }: {once?: boolean, weight?: number, fadeout?: number, fadein?: number, speed?: number}
        ) {
        const anim = this.getAnimation(name);
        if (anim) {
            this.setWeight(anim, weight);
            anim.setEffectiveTimeScale( speed );
            anim.fadeIn(fadein);
            if (once) {
                const onLoopFinished = ( event ) => {
                    if ( event.action === anim ) {
                        this.animation_mixer.removeEventListener( 'loop', onLoopFinished );
                        this.setWeight(anim, 0);
                        anim.fadeOut( fadeout );
                    }
                }
                this.animation_mixer.addEventListener( 'loop', onLoopFinished );
            }
        }
    }

    prepareCrossFade( startAction: THREE.AnimationAction | null, endAction: THREE.AnimationAction | null, duration: number ) {
        if (startAction == endAction) {
            return;
        }

        // If the current action is 'idle', execute the crossfade immediately;
        // else wait until the current action has finished its current loop
        if ( ! startAction || ! endAction ) {
            this.executeCrossFade( startAction, endAction, duration );
        } else {
            this.synchronizeCrossFade( startAction, endAction, duration );
        }

    }

    synchronizeCrossFade( startAction: THREE.AnimationAction | null, endAction: THREE.AnimationAction | null, duration: number ) {
        if (startAction == endAction) {
            return;
        }

        const onLoopFinished = ( event ) => {
            if ( event.action === startAction ) {
                this.animation_mixer.removeEventListener( 'loop', onLoopFinished );
                this.executeCrossFade( startAction, endAction, duration );
            }
        }

        this.animation_mixer.addEventListener( 'loop', onLoopFinished );


        this.current_animation_name = endAction ? endAction.getClip().name : 'None';
    }

    executeCrossFade( startAction: THREE.AnimationAction | null, endAction: THREE.AnimationAction | null, duration: number ) {
        if (startAction == endAction) {
            return;
        }

        // Not only the start action, but also the end action must get a weight of 1 before fading
        // (concerning the start action this is already guaranteed in this place)

        if ( endAction ) {
            this.setWeight( endAction, 1 );
            endAction.time = 0;

            if ( startAction ) {
                // Crossfade with warping
                startAction.crossFadeTo( endAction, duration, true );
            } else {
                // Fade in
                endAction.fadeIn( duration );
            }

        } else if (startAction) {
            // Fade out
            startAction.fadeOut( duration );
        }
        
        this.current_animation_name = endAction ? endAction.getClip().name : 'None';
    }

    setWeight( action: THREE.AnimationAction, weight: number ) {
        action.enabled = true;
        action.setEffectiveTimeScale( 1 );
        action.setEffectiveWeight( weight );
    }
}