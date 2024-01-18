import SceneRender from "./render/scene_render";
import SceneRenderLoader from "./render/scene_render_loader";
import { SceneCollisions, ColliderType } from './scene_collisions';
import { SceneElement, OverridedAssetLink } from "./scene_edit";
import MapTileset from "./map_tileset";

class SceneMapCache {

}

/**
 * MapComponent uses properties by pointer. Change properties fields with caution
 */
class MapComponent {
    properties: any;

    constructor(properties: any) {
        this.properties = properties;
    }
}

class MapEntity {
    id: string;
    inherits: string | null;
    components: { [id: string] : MapComponent }

    constructor(id?: string) {
       this.id = id ?? "";
       this.components = {};
    }

    init(element: SceneElement) {
        this.dispose();
        this.id = element.id;
        
        for(const k in element.components) {
            this.components[k] = new MapComponent(element.components[k].properties)
        }

        return this;
    }

    dispose() {
        for(const k in this.components) {
            delete this.components[k];
        }
    }
}

class SceneMap {
    private scene_render: SceneRender;
    private scene_render_loader: SceneRenderLoader;

    scene_collisions: SceneCollisions;
    entities: { [id: string] : MapEntity; }
    tilesets: { [id: string] : MapTileset; }

    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.scene_render_loader = scene_render.loader;
        this.entities = {};
        this.tilesets = {};
    }

    async run(elements: { [id: string] : SceneElement; }) {
        await this.propagate(elements);
    }

    stop() {
        for(const k in this.entities) {
            this.removeEntity(k, true);
        }

        this.scene_collisions.clear();
    }

    async propagate(elements: { [id: string] : SceneElement; }) {
        const p: Array<Promise<any>> = [];

        for(const id in elements) {
            const element = elements[id];
            p.push(this.addElement(element));
            
        }

        return Promise.all(p);
    }

    async addElement(element: SceneElement) : Promise<MapEntity> {
        const entity = this.entities[element.id] ?? new MapEntity();
        entity.init(element)
        
        this.removeEntity(element.id);
        return await this.addEntity(entity);
    }

    async addEntity(entity: MapEntity) : Promise<MapEntity> {
        const id = entity.id;
        if (this.entities[id]) {
            throw new Error(`Entiry ${id} already exists!`)
        }
        //this.removeEntity(id);

        this.entities[id] = entity;

        if(entity.components.model) {
            const properties = entity.components.model.properties;
            const obj = await this.scene_render.addModel(id, properties);
            this.updateEntityCollider(id);
        }

        if (entity.components.tileset) {
            const properties = entity.components.tileset.properties;
            const tileset = new MapTileset(this.scene_render.assets, id, properties);
            this.tilesets[id] = tileset;
            await tileset.init();

            // preload
            const p: Array<Promise<any>> = [];
            for(const k in tileset.models) {
                p.push(this.scene_render_loader.getModel(k, tileset.models[k]));
            }
            await Promise.all(p);

            // add all tiles
            // it gonna be managed by external class
            /*
            tileset.propagate((modelref: any, id: string, pos_x: number, pos_y: number) => {
                const entity = new MapEntity(id);
                const model = Object.setPrototypeOf({pos_x, pos_y}, modelref);
                entity.components.model = new MapComponent(model);
                this.addEntity(entity);
            })
            */

            // add empty to allow transforms
            const obj = this.scene_render.addEmptyObject(id);
            (obj as any).position.x = properties.pos_x ?? 0;
            (obj as any).position.y = properties.pos_y ?? 0;
        }

        if (entity.components.trigger) {
            const properties = entity.components.trigger.properties;
            await this.scene_render.addTriggerElement(id, entity.components.trigger.properties);
            this.updateEntityCollider(id);
            /*
            if (this._drawDebug2dAabb) {
                this.drawColliderDebug(id, collider);
            }
            */
        }

        return entity;
    }

    removeEntity(id: string, fullclear: boolean = false) {
        const entity = this.entities[id];
        if (!entity) {
            return;
        }

        if(entity.components.model) {
            this.scene_render.removeObject(id, fullclear);
        }

        if (entity.components.trigger) {
            this.scene_render.removeObject(id, fullclear);
        }

        if (entity.components.tileset) {
           const tiles = this.tilesets[id].tiles;
           for(const k in tiles) {
                this.removeEntity(tiles[k], fullclear);
           }
           const models = this.tilesets[id].models;
           for(const k in models) {
                this.scene_render_loader.unloadModel(k, fullclear);
           }
           this.scene_render.removeObject(id, fullclear);
           delete this.tilesets[id];
        }


        this.scene_collisions.removeBody(id);
        this.scene_collisions.removeCollider(id);

        delete this.entities[id];
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

export { SceneMap, SceneMapCache, MapEntity, MapComponent };
export default SceneMap;