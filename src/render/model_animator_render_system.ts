import * as THREE from "../lib/three.module.js";
import { MapSystem, MapEvent, MapEventCode } from "../systems";
import SceneRender from "./scene_render";
import {
	AssetContentTypeAnimator,
	AssetContentTypeModel,
} from "../assets_base_extensions";

class AnimatorNode {
	animator: AssetContentTypeAnimator;
	model: AssetContentTypeModel;
	mixer: THREE.AnimationMixer;
	gltf: any;
	activated: boolean;
	activations: number;
	action: THREE.AnimationAction;

	constructor(
		animator: AssetContentTypeAnimator,
		model: AssetContentTypeModel,
		mixer: THREE.AnimationMixer,
		gltf: any
	) {
		this.animator = animator;
		this.model = model;
		this.mixer = mixer;
		this.gltf = gltf;
		this.activated = false;
		this.activations = 0;
	}

	init() {
		if (this.animator.initial) {
			const action = this.play(this.animator.initial);
			this.mixer.update(1e-64);
			action.timeScale = 0;
		}
	}

	play(name: string): THREE.AnimationAction {
		const action = this.mixer.clipAction(
			THREE.AnimationClip.findByName(this.gltf, name)
		);
		if (this.action && this.action !== action) {
			this.setWeight(this.action, 0);
			this.action.stop();
		}
		if (!action) {
			return;
		}

		this.action = action;
		action.play();
		action.paused = false;
		this.setWeight(action, 1);

		return action;
	}

	activate() {
		this.activated = true;
		if (this.animator.activate) {
			const action = this.play(this.animator.activate);
			action.timeScale = 1;
			action.clampWhenFinished = true;
			action.setLoop(THREE.LoopOnce, 1);
		}
	}

	deactivate() {
		this.activated = false;
		if (this.animator.deactivate) {
			const action = this.play(this.animator.deactivate);
			action.timeScale = 1;
			action.setLoop(THREE.LoopOnce, 1);
			action.clampWhenFinished = true;
		} else if (this.animator.activate) {
			const action = this.play(this.animator.activate);
			action.timeScale = -1;
			action.clampWhenFinished = true;
			action.setLoop(THREE.LoopOnce, 1);
		}
	}

	toggle() {
		if (this.activated) {
			this.deactivate();
		} else {
			this.activate();
		}
	}

	setWeight(action: THREE.AnimationAction, weight: number) {
		action.enabled = true;
		action.setEffectiveTimeScale(1);
		action.setEffectiveWeight(weight);
	}
}

export default class ModelAnimatorRenderSystem extends MapSystem {
	private scene_render: SceneRender;
	nodes: { [id: string]: AnimatorNode };

	constructor(scene_render: SceneRender) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
		this.nodes = {};
	}

	filter(
		component: AssetContentTypeAnimator,
		owner?: AssetContentTypeModel
	): boolean {
		return component.type == "animator" && owner?.type == "model";
	}

	async add(
		component: AssetContentTypeAnimator,
		owner?: AssetContentTypeModel | null
	) {
		if (!this.filter(component, owner)) {
			return;
		}
		const object = this.scene_render.cache.objects[owner.id];
		const mixer = new THREE.AnimationMixer(object);
		const gltf = this.scene_render.cache.gltfs[owner.gltf];

		const node = new AnimatorNode(component, owner, mixer, gltf);
		node.init();

		this.nodes[owner.id] = node;
	}

	remove(component: AssetContentTypeAnimator) {
		delete this.nodes[component.owner];
	}

	step(dt: number) {
		for (const k in this.nodes) {
			this.nodes[k].mixer.update(dt);
		}
	}

	event(event: MapEvent) {
		const node = this.nodes[event.component];
		if (node) {
			console.log(event, node.activations);
			switch (event.code) {
				case MapEventCode.START:
					node.activations += 1;
					if (node.activations == 1) {
						node.activate();
					}
					break;
				case MapEventCode.END:
					node.activations -= 1;
					if (node.activations == 0) {
						node.deactivate();
					}
					break;
				default:
					node.toggle();
			}
		}
	}
}
