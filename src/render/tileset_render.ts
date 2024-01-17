import { SceneMap, MapComponent, MapEntity } from '../scene_map.js';

export default class TilesetRender {
    scene_map: SceneMap;
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
    tiles: Array<MapEntity>
    queue: { [id: string] : MapEntity }

    constructor(scene_map: SceneMap) {
        this.scene_map = scene_map;
        this.min_x = 0;
        this.min_y = 0;
        this.max_x = 0;
        this.max_y = 0;
    }

    run() {
        this.queue = {};
        this.tiles = [];
    }

    update(pos_x, pos_y, ignore: {[id: string] : any}) {
        return;
       this._draw(pos_x, pos_y, ignore);

       // add tiles from queue list
       let added = 0;
       for(const k in this.queue) {
        if (added++ > 1) {
            break;
        }
        const entity = this.queue[k];
        this.scene_map.addEntity(entity);
        delete this.queue[k];
        this.tiles.push(entity);
       }

       // remove random tiles outside bounds
       let picked = 0;
       let removed = 0;
       while(this.tiles.length && picked < 10 && removed < 5) {
        picked += 1;
        const index = Math.floor(Math.random() * this.tiles.length);
        const tile = this.tiles[index];
        const pos_x = this.scene_map.entity_pos_x(tile.id);
        const pos_y = this.scene_map.entity_pos_y(tile.id);
        if (pos_x < this.min_x - 2 || pos_x > this.max_x + 2|| pos_y < this.min_y - 2 || pos_y > this.max_y + 2) {
            this.scene_map.removeEntity(tile.id);
            
            //remove from array
            const b = this.tiles[0];
            this.tiles[index] = b;
            this.tiles.shift();
            removed += 1;
        } 
       }
    }

    _draw(pos_x, pos_y, ignore: {[id: string] : any}) {
        const clip_w = 5;
        const clip_h = 5;
        const x = Math.round(pos_x);
        const y = Math.round(pos_y);
        this.min_x = x - clip_w;
        this.min_y = y - clip_h;
        this.max_x = x + clip_w;
        this.max_y = y + clip_h;
        
        for(const k in this.scene_map.tilesets) {
            const tileset = this.scene_map.tilesets[k]
            tileset.propagate((model: any, id: string) => {
                if (this.scene_map.entities[id] || id in ignore || this.queue[id]) {
                    return;
                }
                const entity = new MapEntity(id);
                entity.components.model = new MapComponent(model);
                this.queue[id] = entity;
            }, this.min_x, this.min_y, this.max_x, this.max_y);
        }
    }
}