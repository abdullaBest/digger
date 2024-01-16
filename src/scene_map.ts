import SceneRender from "./render/scene_render";
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
    components: { [id: string] : MapComponent }

    constructor(id?: string) {
       this.id = id ?? "";
       this.components = {};
    }

    init(element: SceneElement) {
        this.id = element.id;

        for(const k in element.components) {
            this.components[k] = new MapComponent(element.components[k].properties)
        }

        return this;
    }
}

class SceneMap {
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    entities: { [id: string] : MapEntity; }
    tilesets: { [id: string] : MapTileset; }

    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.entities = {};
        this.tilesets = {};
    }

    async run(elements: { [id: string] : SceneElement; }) {
        await this.propagate(elements);
    }

    stop() {
        for(const k in this.entities) {
            this.removeEntity(k);
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
        const entity = new MapEntity().init(element);

        return await this.addEntity(entity);
    }

    async addEntity(entity: MapEntity) : Promise<MapEntity> {
        const id = entity.id;
        this.removeEntity(id);

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
            const tiles = {};
            tileset.propagate((model: any, id: string) => {
                tiles[id] = model;
            })

            for(const k in tiles) {
                const entity = new MapEntity(k);
                entity.components.model = new MapComponent(tiles[k]);
                await this.addEntity(entity);
            }
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

    removeEntity(id: string) {
        const entity = this.entities[id];
        if (!entity) {
            return;
        }

        if(entity.components.model) {
            this.scene_render.removeModel(id);
        }

        if (entity.components.tileset) {
           // this.scene_render.removeTileset(id);
           const tiles = this.tilesets[id].tiles;
           for(const k in tiles) {
            this.removeEntity(tiles[k]);
           }
        }

        if (entity.components.trigger) {
            this.scene_render.removeElement(id);
        }

        this.scene_collisions.removeBody(id);
        this.scene_collisions.removeCollider(id);

        delete this.entities[id];
    }

    updateEntityCollider(id: string) {
        const entity = this.entities[id];

        this.scene_collisions.removeBody(id);
        this.scene_collisions.removeCollider(id);

        if(entity.components.model) {
            const properties = entity.components.model.properties;
            const obj = this.scene_render.cache.objects[id];
            if (properties.collider) {
                const box = this.scene_render.produceObjectCollider(id, obj, this.scene_collisions.origin, this.scene_collisions.normal);
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
}

export { SceneMap, SceneMapCache };
export default SceneMap;