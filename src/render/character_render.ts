import * as THREE from '../lib/three.module.js';
import Character from "../character.js";
import SceneRender from "./scene_render";
import { SceneCollisions } from '../scene_collisions.js';
import { lerp, distlerp } from '../math.js';

export default class CharacterRender {
    character: Character;
    scene_render: SceneRender;
    character_gltf: any;
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

        this.character_gltf = await this.scene_render.addGLTF("res/KayKit_AnimatedCharacter_v1.2.glb", "player_character");
        //this.character_gltf.scene.children[0].position.y = -0.5;
        this.character_gltf.scene.scale.set(0.5, 0.5, 0.5);
        this.animation_mixer = new THREE.AnimationMixer(this.character_gltf.scene);
        this.animations_actions_cache = {};
        this.current_animation_name = null;
        this.character_x_rot = 0;

        this.ui_interact_sprite = await this.scene_render.makeSprite("DPAD_up");
        (this.ui_interact_sprite as any).position.y = 2.5;
        this.character_gltf.scene.add(this.ui_interact_sprite);
        this.character_gltf.scene.visible = this.draw_character_mesh;

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
            this.playAnimation("Jump", { once: true, weight: 0.9, speed: 1.5 });
        } else if(this.character.performed_actions.find((e) => e.tag == "hit")) {
            this.playAnimation("Attack(1h)", { once: true, weight: 0.9, speed: 2 });
        } else if (this.character.movement_x && this.current_animation_name != "Run") {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("Run"), 0.1);
        } else if (!this.character.movement_x) {
            this.executeCrossFade(this.getAnimation(this.current_animation_name), this.getAnimation("Idle"), 0.8);
        }
    }

    renderCharacterModel(dt: number) {
        const cha = this.character_gltf.scene;
        const body = this.character.body;

        // set object positions
        // { tmp. will be moved into object render class
        if (!cha.steplerpinfo) {
            cha.steplerpinfo = {
                pos_x: 0, pos_y: 0, elapsed: 0, step_number: this.colliders.step_number, prev_x: body.collider.x, prev_y: body.collider.y, next_x: body.collider.x, next_y: body.collider.y
            };
        }
        if (this.colliders.step_number != cha.steplerpinfo.step_number) {
            cha.steplerpinfo.prev_x = cha.steplerpinfo.next_x;
            cha.steplerpinfo.prev_y = cha.steplerpinfo.next_y;
            cha.steplerpinfo.next_x = body.collider.x;
            cha.steplerpinfo.next_y = body.collider.y;
            cha.steplerpinfo.step_number = this.colliders.step_number;
            cha.steplerpinfo.elapsed = 0;
            
            const dbg_point = this.debug_bodypos_path.shift();
            if (dbg_point) {
                this.debug_bodypos_path.push(dbg_point);
                this.scene_render.setPos(dbg_point, this.scene_render.cache.vec3_0.set(body.collider.x, body.collider.y, 0))
            }
        }
        // tmp }

        let x = lerp(cha.steplerpinfo.prev_x, cha.steplerpinfo.next_x, cha.steplerpinfo.elapsed / (this.colliders.last_step_elapsed));
        let y = lerp(cha.steplerpinfo.prev_y, cha.steplerpinfo.next_y, cha.steplerpinfo.elapsed / (this.colliders.last_step_elapsed));
        cha.steplerpinfo.elapsed += dt;
        //x += body.velocity_x * this.colliders.step_threshold * 0.5;
        //y += body.velocity_y * this.colliders.step_threshold * 0.5;
    
        let lx = distlerp(cha.steplerpinfo.pos_x, x, 1e-4, 1e-1);
        let ly = distlerp(cha.steplerpinfo.pos_y, y, 1e-4, 1e-1);
        //let lx = lerp(cha.steplerpinfo.pos_x, x, Math.max(0, 0.1 - Math.abs(cha.steplerpinfo.pos_x - x)));
        //let ly = lerp(cha.steplerpinfo.pos_y, y, 0.1);
        cha.steplerpinfo.pos_x = lx;
        cha.steplerpinfo.pos_y = ly;

        if (this.debug_bodypos1 && this.debug_bodypos2) {
            this.scene_render.setPos(this.debug_bodypos1, this.scene_render.cache.vec3_0.set(x, y, 0));
            this.scene_render.setPos(this.debug_bodypos2, this.scene_render.cache.vec3_0.set(lx, ly, 0));
        }

        this.scene_render.setPos(cha, this.scene_render.cache.vec3_0.set(lx, ly - body.collider.height/2, 0));

        this.character_x_rot = lerp(this.character_x_rot, this.character.look_direction_x, 0.2) ;
        cha.lookAt(this.scene_render.cache.vec3_0.set(lx + this.character_x_rot, ly  - body.collider.height/2 + this.character.look_direction_y * 0.3,  1 - Math.abs(this.character_x_rot)));
    }

    getAnimation(name: string | null, gltf = this.character_gltf) : THREE.AnimationAction | null {
        if (!name) {
            return null;
        }

        if (!this.animation_mixer) {
            throw new Error("CharacterRender::playAnimation error - No animation mixer set");
        }

        let action = this.animations_actions_cache[name] ?? this.animation_mixer.clipAction(THREE.AnimationClip.findByName(gltf, name));
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