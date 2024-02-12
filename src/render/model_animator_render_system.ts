import * as THREE from '../lib/three.module.js';
import { MapSystem } from "../systems";
import SceneRender from "./scene_render";
import {
	AssetContentTypeAnimator,
	AssetContentTypeModel,
} from "../assets_base_extensions";

export default class ModelAnimatorRenderSystem extends MapSystem {
	private scene_render: SceneRender;
	mixers: { [id: string] : THREE.AnimationMixer };

	constructor(scene_render: SceneRender) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
		this.mixers = {};
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

		if (component.initial) {
			const action = mixer.clipAction(THREE.AnimationClip.findByName(gltf, component.initial));
			console.log(action);
			action.play();
			mixer.update(1e-64);
			mixer.timeScale = 0;
		}
		this.mixers[component.id] = mixer;
	}
	remove(component: AssetContentTypeAnimator) {}
	step(dt: number) {
		for(const k in this.mixers) {
			this.mixers[k].update(dt);
		}
	}

	setWeight( action: THREE.AnimationAction, weight: number ) {
		action.enabled = true;
		action.setEffectiveTimeScale( 1 );
		action.setEffectiveWeight( weight );
	}
}
