import SceneRender from "./render/scene_render";
import SceneRenderLoader from "./render/scene_render_loader";
import { SceneCollisions, ColliderType } from './scene_collisions';
import MapTileset from "./map_tileset";
import { Matter, Matters } from "./matters";
import { AssetContentTypeComponent, AssetContentTypeModel } from './assets';

class MapSystem {
    add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {}
    remove(component: AssetContentTypeComponent) {}
}

class MapRenderModelSystem extends MapSystem {
    private scene_render: SceneRender;
    constructor(scene_render: SceneRender) {
        super();
        this.scene_render = scene_render;
    }

    add(component: AssetContentTypeModel, owner?: AssetContentTypeComponent) {
        const obj = this.scene_render.addModel(component.id, component);
    }

    remove(component: AssetContentTypeModel) {
        this.scene_render.removeObject(component.id);
    }
}

class SceneMap {
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    matters: Matters;
    components: { [id: string] : AssetContentTypeComponent }
    tilesets: { [id: string] : MapTileset; }
    systems: { [id: string] : MapSystem; }

    constructor(matters: Matters, scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.matters = matters;
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.components = {};
        this.tilesets = {};
        this.systems = {
            model: new MapRenderModelSystem(this.scene_render)
        };
    }

    add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {
        const system = this.systems[component.type];
        if (system) {
            system.add(component, owner);
        }

        for(const k in component) {
            const val = component[k];
            if (typeof val === "string" && val.startsWith("**")) {
                this.add(this.matters.get(val.substring(2)) as AssetContentTypeComponent, component);
            }
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

        const system = this.systems[component.type];
        if (system) {
            system.remove(component);
        }

        delete this.components[component.id];
    }

    cleanup() {
        for(const k in this.components) {
            this.remove(this.components[k]);
        }
    }

    updateEntityCollider(id: string) {
        const entity = this.entities[id];

        // should use setpos/setsize here
        this.scene_collisions.removeBody(id);
        this.scene_collisions.removeCollider(id);

        if(entity.components.model) {
            const properties = entity.components.model.properties;
            const obj = this.scene_render.cache.objects[id];
            if (properties.collider) {
                const box = this.scene_render.genObject2dAABB(id, obj, this.scene_collisions.origin, this.scene_collisions.normal);
                if (box) {
                    this.scene_collisions.createBoxCollider(id, box);
                } 
            }
        }

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

export { SceneMap, MapEntity, MapComponent };
export default SceneMap;