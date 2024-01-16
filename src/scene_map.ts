import SceneRender from "./render/scene_render";
import { SceneCollisions } from './scene_collisions';
import { SceneElement } from "./scene_edit";

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
    name: string;
    components: { [id: string] : MapComponent }

    constructor(element: SceneElement) {
        this.name = element.name;
        this.id = element.id;
        this.components = {};

        for(const k in element.components) {
            this.components[k] = new MapComponent(element.components[k].properties)
        }
    }
}

class SceneMap {
    private scene_render: SceneRender;
    scene_collisions: SceneCollisions;
    entities: { [id: string] : MapEntity; }

    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.entities = {};
    }

    async run(elements: { [id: string] : SceneElement; }) {
        await this.propagate(elements);
    }

    stop() {
        for(const k in this.entities) {
            this.removeEntity(k);
        }
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
        const entity = new MapEntity(element);

        return await this.addEntity(entity);
    }

    async addEntity(entity: MapEntity) : Promise<MapEntity> {
        const id = entity.id;
        this.removeEntity(id);

        this.entities[id] = entity;

        if(entity.components.model) {
            await this.scene_render.addModel(id, entity.components.model.properties);
        }

        if (entity.components.tileset) {
            await this.scene_render.addTileset(id, entity.components.tileset.properties);
        }

        if (entity.components.trigger) {
            await this.scene_render.addTriggerElement(id, entity.components.trigger.properties);
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
            this.scene_render.removeTileset(id);
        }

        if (entity.components.trigger) {
            this.scene_render.removeElement(id);
        }
    }
}

export { SceneMap, SceneMapCache };
export default SceneMap;