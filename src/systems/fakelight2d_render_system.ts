import * as THREE from "../lib/three.module.js";
import SceneRender from "../render/scene_render";
import SceneCore from "../app/scene_core";
import { MapSystem } from ".";
import { AssetContentTypeComponent, AssetContentTypeFakeLight2d } from "../app/assets";

const SHAPES_TO_SPRITENAMES = {
	"circle": "masks/circle",
	"circle-gradient": "masks/circle-gradient",
	"square": "masks/square",
	"square-gradient": "masks/square-gradient",
}

export default class FakeLight2dRenderSystem extends MapSystem {
	private scene_render: SceneRender;
	private scene_core: SceneCore;
	sprite_refs: { [id: string]: THREE.Sprite | THREE.Mesh };
	sprites: { [id: string]: THREE.Sprite | THREE.Mesh };

	constructor(scene_render: SceneRender, scene_core: SceneCore) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
		this.sprites = {};
		this.sprite_refs = {};
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

		const spriteshape = this._getSpriteShapeName(component);

		if (this.sprite_refs[spriteshape]) {
			return;
		}

		const spritepath = SHAPES_TO_SPRITENAMES[component.shape];
		if (!spritepath) {
			throw new Error(`FakeLight2dRenderSystem::load error - no predefined sprite for shape ${component.shape}`);
		}

		// btw no need in cache here
		let sprite = null;
		if (component.billboard) {
			sprite = await this.scene_render.makeSprite(spritepath);
		} else {
			sprite = await this.scene_render.makeSprite3d(spritepath);
		}

		this.sprite_refs[spriteshape] = sprite;

	}
	
	add(
		component: AssetContentTypeFakeLight2d,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}

		const spriteshape = this._getSpriteShapeName(component);
		const sprite = this.sprite_refs[spriteshape]?.clone();

		if (!sprite) {
			throw new Error(`FakeLight2dRenderSystem::add error - no sprite ${component.shape} was preloaded`);
		}

		this.sprites[component.id] = sprite;
		this.scene_render.fakelights_scene.add(sprite);
		(sprite as any).position.x = owner.pos_x ?? 0;
		(sprite as any).position.y = owner.pos_y ?? 0;
		(sprite as any).scale.x = component.size_x;
		(sprite as any).scale.y = component.size_y;

		// not quite managable but fits current goal
		(sprite as any).position.z = 0.5;

		// Gonna change colors for all instances.
		// Could be a problem but fine for now
		sprite.material.color.set(component.color);
		sprite.material.transparent = true;
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
