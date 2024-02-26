import logger from "../core/logger";
import SceneRender from "../render/scene_render";
import SceneRenderLoader from "../render/scene_render_loader";
import {
	SceneCollisions,
	ColliderType,
	BoxColliderC,
} from "./scene_collisions";
import { Matter, Matters } from "../core/matters";
import {
	AssetContentTypeComponent,
	AssetContentTypeModel,
	AssetContentTypeCollider,
} from "./assets";
import SceneMath from "../render/scene_math";
import { MapSystem, MapEvent, MapEventCode, MapTilesetSystem } from "../systems";
import MapDebugRenderCollidersSystem from "../systems/map_debug_render_colliders_system";
import ModelAnimatorRenderSystem from "../systems/model_animator_render_system";

/**
 * Just creates empties. Disabled
 */
class SceneRenderComponentSystem extends MapSystem {
	private scene_render: SceneRender;
	constructor(scene_render: SceneRender) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
	}

	filter(component: AssetContentTypeComponent): boolean {
		return component.type == "component";
	}

	add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}

		return;
		const parent = (owner && this.scene_render.cache.objects[owner.id]) ?? null;
		const obj = this.scene_render.addEmptyObject(component.id, parent);
		if (
			typeof component.pos_x !== "undefined" &&
			typeof component.pos_y !== "undefined"
		) {
			(obj as any).position.x = component.pos_x;
			(obj as any).position.y = component.pos_y;
		}
	}

	remove(component: AssetContentTypeModel) {
		this.scene_render.removeObject(component.id);
	}
}

class SceneRenderModelSystem extends MapSystem {
	private scene_render: SceneRender;
	constructor(scene_render: SceneRender) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
	}

	filter(component: AssetContentTypeComponent): boolean {
		return component.type == "model";
	}

	async load(component: AssetContentTypeModel) {
		if (!this.filter(component)) {
			return;
		}

		await this.scene_render.loader.loadModel(component);
	}

	add(
		component: AssetContentTypeModel,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}
		const obj = this.scene_render.addModel(
			component.id,
			component
		);
	}

	remove(component: AssetContentTypeModel) {
		this.scene_render.removeObject(component.id);
	}
}

class SceneCollidersSystem extends MapSystem {
	private scene_render: SceneRender;
	private scene_collisions: SceneCollisions;
	constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
		super();
		this.priority = -1;
		this.scene_collisions = scene_collisions;
		this.scene_render = scene_render;
	}

	filter(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type == "collider" && !!owner;
	}

	add(
		component: AssetContentTypeCollider,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component, owner)) {
			return;
		}

		if (!owner) {
			throw new Error(
				"SceneCollidersSystem:add error - this component can't be used without owner node."
			);
		}

		const collider_type = component.trigger
			? ColliderType.SIGNAL
			: ColliderType.RIGID;

		if (component.autosize) {
			const box = SceneMath.instance.genObject2dAABB(
				this.scene_render.cache.objects[owner.id],
				this.scene_collisions.origin,
				this.scene_collisions.normal
			);

			if (box) {
				this.scene_collisions.createBoxCollider(
					component.id,
					box,
					collider_type
				);
			}
		} else {
			const collider = this.scene_collisions.createBoxColliderByPos(
				component.id,
				(owner.pos_x ?? 0) + component.x,
				(owner.pos_y ?? 0) + component.y,
				component.width,
				component.height,
				collider_type
			);
		}
	}

	remove(component: AssetContentTypeComponent): void {
		this.scene_collisions.removeBody(component.id);
		this.scene_collisions.removeCollider(component.id);
	}
}

class SceneCore {
	scene_render: SceneRender;
	scene_collisions: SceneCollisions;
	matters: Matters;

	// list of component instances.
	components: { [id: string]: AssetContentTypeComponent };
	// list of instances but keys is source id's
	// ofc several instances of same source gonna produce only one entry here
	csources: { [id: string]: AssetContentTypeComponent };

	systems: { [id: string]: MapSystem };

	constructor(
		matters: Matters,
		scene_collisions: SceneCollisions,
		scene_render: SceneRender
	) {
		this.matters = matters;
		this.scene_collisions = scene_collisions;
		this.scene_render = scene_render;
		this.components = {};
		this.csources = {};
		this.systems = {
			model: new SceneRenderModelSystem(this.scene_render),
			animator: new ModelAnimatorRenderSystem(this.scene_render),
			component: new SceneRenderComponentSystem(this.scene_render),
			collider: new SceneCollidersSystem(
				this.scene_collisions,
				this.scene_render
			),
			debug_colliders: new MapDebugRenderCollidersSystem(
				this.scene_collisions,
				this.scene_render
			),
			tileset: new MapTilesetSystem(this.matters),
			// ... some systems may be added runtime
		};
	}

	async load(component: AssetContentTypeComponent) {
		logger.log(`SceneCore: Loading component #${component.id} (${component.name})`)
		const promises: Array<Promise<any>> = [];
		this.matters.traverse(
			component.id,
			null,
			(m) => {
				const matter = m as AssetContentTypeComponent;
				for (const k in this.systems) {
					const system = this.systems[k];
					promises.push(system.load(matter));
				}
			}
		);

		return Promise.all(promises);
	}

	/**
	 * Creates separate component instance and registers it in systems
	 *
	 * @param component component to add on scene
	 * @param owner upper-tree component. do not mess up with AssetContentTypeComponent.owner
	 * @param id new instance id
	 * @returns {AssetContentTypeComponent} instance
	 */
	add(
		component: AssetContentTypeComponent,
		owner?: AssetContentTypeComponent | null,
		id?: string | null
	): AssetContentTypeComponent | null {
		if (component.abstract) {
			return null;
		}

		const cinstace = this.matters.create(
			{ owner: owner?.id ?? null },
			component.id,
			id
		) as AssetContentTypeComponent;

		for (const k in this.systems) {
			const system = this.systems[k];
			system.add(cinstace, owner);
		}

		const subcomponents: Array<{
			key: string;
			component: AssetContentTypeComponent;
		}> = [];
		for (const key in component) {
			if (component.is_link(key)) {
				subcomponents.push({
					key,
					component: this.matters.get(
						component.get(key)
					) as AssetContentTypeComponent,
				});
			}
		}

		subcomponents.sort((a, b) => {
			const sa = this.systems[a.component.type];
			const sb = this.systems[b.component.type];
			return (
				(sb?.filter(b.component, component) ? sb.priority : 0) -
				(sa?.filter(a.component, component) ? sa.priority : 0)
			);
		});

		for (const i in subcomponents) {
			const subc = subcomponents[i];
			const subcomponent = this.add(subc.component, cinstace);
			if (subcomponent) {
				cinstace.set_link(subc.key, subcomponent.id);
			}
		}

		this.components[cinstace.id] = cinstace;
		this.csources[cinstace.inherites as string] = cinstace;

		return cinstace;
	}

	/**
	 * removes component instance
	 * @param refid reference component id
	 * @param id
	 * @returns
	 */
	remove(id: string) {
		let component = this.components[id] as AssetContentTypeComponent;

		// not sure that it should be here
		if (!component) {
			for (const k in this.components) {
				const _c = this.components[k];
				if (_c.inherites == id) {
					this.remove(_c.id);
				}
			}
		}

		if (!component || component.abstract) {
			return;
		}

		if (!component.inherites) {
			throw new Error(`Component ${id} is not an instance of anything`);
		}

		for (const key in component) {
			if (component.is_link(key)) {
				const _component = this.matters.get(component.get(key));
				if (_component) {
					this.remove(_component.id);
				}
			}
		}

		for (const k in this.systems) {
			const system = this.systems[k];
			system.remove(component);
		}

		this.matters.remove(id);
		delete this.components[component.id];
		delete this.csources[component.inherites];
	}

	/**
	 * @brief removes component from systems but not from scene
	 *
	 * @param id {string}
	 */
	hide(id: string) {
		const component = this.components[id];
		for (const key in component) {
			if (component.is_link(key)) {
				const _component = this.matters.get(component.get(key));
				if (_component) {
					this.hide(_component.id);
				}
			}
		}

		for (const k in this.systems) {
			const system = this.systems[k];
			system.remove(component);
		}
	}

	/**
	 * @brief returns component into systems but not from scene
	 *
	 * @param id {string}
	 */
	show(id: string) {
		const component = this.components[id];
		for (const key in component) {
			if (component.is_link(key)) {
				const _component = this.matters.get(component.get(key));
				if (_component) {
					this.show(_component.id);
				}
			}
		}

		const owner = this.matters.get(
			component.owner
		) as AssetContentTypeComponent;
		for (const k in this.systems) {
			const system = this.systems[k];
			system.add(component, owner);
		}
	}

	// Calls event in systems
	event(event: MapEvent) {
		for (const k in this.systems) {
			this.systems[k].event(event);
		}
	}

	cleanup() {
		for (const k in this.components) {
			this.remove(k);
		}
	}

	addSystem(name: string, system: MapSystem) {
		this.systems[name] = system;
		for (const k in this.components) {
			system.add(this.components[k]);
		}
	}

	removeSystem(name: string) {
		const system = this.systems[name];
		if (!system) {
			return;
		}

		for (const k in this.components) {
			system.remove(this.components[k]);
		}
		delete this.systems[name];
	}

	step(dt: number) {
		for (const k in this.systems) {
			this.systems[k].step(dt);
		}
	}
}

class MapEntity {}
class MapComponent {}

export { SceneCore, MapEntity, MapComponent };
export default SceneCore;
