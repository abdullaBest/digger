import { SceneMap, MapComponent, MapEntity } from '../scene_map.js';

export default class TilesetRender {
    scene_map: SceneMap;
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;

    // all tiles that currently on scene
    tiles: Array<MapEntity>
    // tile add queue
    queue: { [id: string] : MapEntity }
    // removed tiles that can be reused
    dump: { [id: string] : Array<MapEntity> }

    clip_w: number;
    clip_h: number;

    constructor(scene_map: SceneMap) {
        this.scene_map = scene_map;
        this.min_x = 0;
        this.min_y = 0;
        this.max_x = 0;
        this.max_y = 0;
        this.clip_h = 5;
        this.clip_w = 5;
    }

    run() {
        this.queue = {};
        this.tiles = [];
        this.dump = {};
    }

    update(pos_x, pos_y, ignore: {[id: string] : any}) {
       this._draw(pos_x, pos_y, ignore);

       // add tiles from queue list
       let added = 0;
       for(const k in this.queue) {
        if (added++ > 1) {
            break;
        }
        const entity = this.queue[k];
        this.scene_map.addEntity(entity).then(() => this.tiles.push(entity))
        delete this.queue[k];
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
        if (pos_x < this.min_x - this.clip_w || pos_x > this.max_x + this.clip_w|| pos_y < this.min_y - this.clip_h || pos_y > this.max_y + this.clip_h) {
            this.scene_map.removeEntity(tile.id);
            
            //remove from array
            const b = this.tiles[0];
            this.tiles[index] = b;
            this.tiles.shift();
            removed += 1;

            if (tile.inherits) {
                let arr = this.dump[tile.inherits]
                if (!arr) {
                    arr = this.dump[tile.inherits] = [];
                }
                arr.push(tile);
            } else {}
        } 
       }
    }

    _draw(pos_x, pos_y, ignore: {[id: string] : any}) {
        const clip_w = this.clip_w;
        const clip_h = this.clip_h;
        const x = Math.round(pos_x);
        const y = Math.round(pos_y);
        this.min_x = x - clip_w;
        this.min_y = y - clip_h;
        this.max_x = x + clip_w;
        this.max_y = y + clip_h;
        
        for(const k in this.scene_map.tilesets) {
            const tileset = this.scene_map.tilesets[k]
            tileset.propagate((ref_id: any, id: string, pos_x: number, pos_y: number) => {
                if (this.scene_map.entities[id] || id in ignore || this.queue[id]) {
                    return;
                }
                let entity = this.dump[ref_id]?.pop();
                if (!entity) {
                    entity = new MapEntity(id);
                    // tynroar todo: make proper inheritance insead of ref_id
                    entity.inherits = ref_id;
                    const model = Object.setPrototypeOf({ pos_x, pos_y }, tileset.models[ref_id]);
                    entity.components.model = new MapComponent(model);
                } else {
                    const model = entity.components.model;
                    model.properties.pos_x = pos_x;
                    model.properties.pos_y = pos_y;
                }
               
                this.queue[id] = entity;
            }, this.min_x, this.min_y, this.max_x, this.max_y);
        }
    }
}