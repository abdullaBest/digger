import * as THREE from "../lib/three.module.js";
import SceneRender from "../render/scene_render";
import SceneCore from "../app/scene_core";
import { MapSystem } from ".";
import { AssetContentTypeTexture, AssetContentTypeComponent, AssetContentTypeFakeLight2d } from "../app/assets";

export default class FakeLight2dRenderSystem extends MapSystem {
	private scene_render: SceneRender;
	private scene_core: SceneCore;
	sprite_refs: { [id: string]: THREE.Sprite | THREE.Mesh };
	sprites: { [id: string]: THREE.Sprite | THREE.Mesh };

	constructor(scene_render: SceneRender, scene_core: SceneCore) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
		this.scene_core = scene_core;
		this.sprites = {};
	}

	filter(component: AssetContentTypeComponent): boolean {
		return component.type == "fakelight2d";
	}

	_getSpriteShapeName(component: AssetContentTypeFakeLight2d) {
		const spritetype = component.billboard ? "b" : "s"
		const spriteshape = spritetype + component.shape;

		return spriteshape;
	}

	async load(component: AssetContentTypeFakeLight2d) {
		if (!this.filter(component)) {
			return;
		}

		const textureurl = (
			this.scene_core.matters.get(component.shape) as AssetContentTypeTexture
		).url;
		await this.scene_render.loader.loadTexture(textureurl, component.shape);
	}
	
	add(
		component: AssetContentTypeFakeLight2d,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}

		let sprite = null;
		if (component.billboard) {
			const material = this.scene_render.loader.getMaterial("sprite", component.shape);
			sprite = new THREE.Sprite(material as THREE.SpriteMaterial);
		} else {
			const material = this.scene_render.loader.getMaterial("basic", component.shape);
			const geometry = new THREE.PlaneGeometry(1, 1);
			sprite = new THREE.Mesh(geometry, material as any);
		}
		this.sprites[component.id] = sprite;
		this.scene_render.fakelights_scene.add(sprite);
		(sprite as any).position.x = (owner.pos_x ?? 0) + (component.pos_x ?? 0);
		(sprite as any).position.y = (owner.pos_y ?? 0) + (component.pos_y ?? 0);
		(sprite as any).scale.x = component.size_x;
		(sprite as any).scale.y = component.size_y;

		// not quite managable but fits current goal
		(sprite as any).position.z = 0.5;

		// Gonna change colors for all instances.
		// Could be a problem but fine for now
		sprite.material.color.set(component.color);
		sprite.material.transparent = true;
		if (component.z_index) {
			sprite.material.depthTest = false;
			sprite.renderOrder = component.z_index;
		}
	}

	remove(
		component: AssetContentTypeFakeLight2d,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}
		const sprite = this.sprites[component.id];
		if (sprite) {
			delete this.sprites[component.id];
			sprite.removeFromParent();
		}
	}
}
