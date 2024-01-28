import SceneRender from "./render/scene_render";
import SceneRenderLoader from "./render/scene_render_loader";
import { SceneCollisions, ColliderType, BoxColliderC } from './scene_collisions';
import { Matter, Matters } from "./matters";
import { AssetContentTypeComponent, AssetContentTypeModel } from './assets';
import SceneMath from "./scene_math";
import { MapSystem, MapTilesetSystem } from "./systems";
import MapDebugRenderCollidersSystem from "./render/map_debug_render_colliders_system";

/**
 * Just creates empties
 */
class SceneRenderComponentSystem extends MapSystem {
    private scene_render: SceneRender;
    constructor(scene_render: SceneRender) {
        super();
        this.priority = 0;
        this.scene_render = scene_render;
    }

    filter(component: AssetContentTypeComponent) : boolean {
        return component.type == "component";
    }

    async add(component: AssetContentTypeModel, owner?: AssetContentTypeComponent) {
        if (!this.filter(component)) {
            return;
        }
        const parent = (owner && this.scene_render.cache.objects[owner.id]) ?? null
        const obj = this.scene_render.addEmptyObject(component.id, parent);
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

    filter(component: AssetContentTypeComponent) : boolean {
        return component.type == "model";
    }

    async load(component: AssetContentTypeModel) {
        if (!this.filter(component)) {
            return;
        }

        await this.scene_render.loader.getModel(component.id, component);
    }

    async add(component: AssetContentTypeModel, owner?: AssetContentTypeComponent) {
        if (!this.filter(component)) {
            return;
        }
        const parent = (owner && this.scene_render.cache.objects[owner.id]) ?? null
        const obj = await this.scene_render.addModel(component.id, component, parent);
    }

    remove(component: AssetContentTypeModel) {
        this.scene_render.removeObject(component.id);
    }
}

class SceneCollidersSystem extends MapSystem {
    private scene_render: SceneRender;
    private scene_collisions: SceneCollisions;
    private colliders: { [id: string] : string }
    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        super();
        this.priority = -1;
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;

        this.colliders = {};
    }

    filter(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) : boolean {
        return component.type == "collider" && !!owner;
    }

    async add(component: AssetContentTypeModel, owner?: AssetContentTypeComponent) {
        if (!this.filter(component, owner)) {
            return;
        }

        if (!owner) {
            throw new Error("SceneCollidersSystem:add error - this component can't be used without owner node.")
        }

        const box = SceneMath.instance.genObject2dAABB(this.scene_render.cache.objects[owner.id], this.scene_collisions.origin, this.scene_collisions.normal);
        if (box) {
            this.scene_collisions.createBoxCollider(owner.id, box);
            this.colliders[component.id] = owner.id;
        } 

    }

    remove(component: AssetContentTypeComponent): void {
        const collider = this.colliders[component.id];
        if (!collider) {
            return;
        }
        this.scene_collisions.removeBody(collider)
        this.scene_collisions.removeCollider(collider)
        delete this.colliders[component.id];
    }
}

class SceneCore {
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    matters: Matters;
    components: { [id: string] : AssetContentTypeComponent }
    systems: { [id: string] : MapSystem; }

    constructor(matters: Matters, scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.matters = matters;
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.components = {};
        this.systems = {
            model: new SceneRenderModelSystem(this.scene_render),
            component: new SceneRenderComponentSystem(this.scene_render),
            collider: new SceneCollidersSystem(this.scene_collisions, this.scene_render),
            debug_colliders: new MapDebugRenderCollidersSystem(this.scene_collisions, this.scene_render),
            tileset: new MapTilesetSystem(this.matters)
            // ... some systems may be added runtime
        };
    }

    async add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {
        for(const k in this.systems) {
            const system = this.systems[k];
            await system.load(component);
            await system.add(component, owner);
        }
       
        const subcomponents: Array<AssetContentTypeComponent> = [];
        for(const k in component) {
            const val = component[k];
            if (typeof val === "string" && val.startsWith("**")) {
                subcomponents.push(this.matters.get(val.substring(2)) as AssetContentTypeComponent)
            }
        }

        subcomponents.sort((a, b) => {
            const sa = this.systems[a.type];
            const sb = this.systems[b.type]
            return (sb?.filter(b, component) ? sb.priority : 0) - (sa?.filter(a, component) ? sa.priority : 0)
        })

        for(const i in subcomponents) {
            await this.add(subcomponents[i], component);
        }

        this.components[component.id] = component;
    }

    remove(component: AssetContentTypeComponent) {
        for(const k in component) {
            const val = component[k];
            if (typeof val === "string" && val.startsWith("**")) {
                this.remove(this.matters.get(val.substring(2)) as AssetContentTypeComponent);
            }
        }

        for(const k in this.systems) {
            const system = this.systems[k];
            system.remove(component);
        }

        delete this.components[component.id];
    }

    cleanup() {
        for(const k in this.components) {
            this.remove(this.components[k]);
        }
    }

    addSystem(name: string, system: MapSystem) {
        this.systems[name] = system;
        for(const k in this.components) {
            system.add(this.components[k]);
        }
    }

    updateEntityCollider(id: string) {
        const entity = null;

        if (entity.components.trigger) {
            const properties = entity.components.trigger.properties;
            const pos_x = properties.pos_x;
            const pos_y = properties.pos_y;
            const collider = this.scene_collisions.createBoxColliderByPos(id, pos_x, pos_y, properties.width, properties.height, ColliderType.SIGNAL);
        }
    }

    entity_pos_x(id: string) {
        const c = this.scene_collisions.colliders[id];
        if (c) {
            return c.x;
        }

        return 0;
    }

    entity_pos_y(id: string) {
        const c = this.scene_collisions.colliders[id];
        if (c) {
            return c.y;
        }

        return 0;
    }
}

class MapEntity {};
class MapComponent {};

export { SceneCore, MapEntity, MapComponent };
export default SceneCore;