import { SceneMap, MapComponent, MapEntity } from '../scene_map.js';

export default class TilesetRender {
    scene_map: SceneMap;
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;

    clip_tiles_draw: boolean;

    // all tiles that currently on scene
    tiles: Array<MapEntity>
    // tile add queue
    queue: { [id: string] : MapEntity }
    queued: number;
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
        this.clip_h = 16;
        this.clip_w = 16;
        this.queued = 0;
        this.clip_tiles_draw = true;
    }

    run() {
        this.queue = {};
        this.tiles = [];
        this.dump = {};
    }

    _isPosInClipbounds(pos_x: number, pos_y: number) {
        if (!this.clip_tiles_draw) {
            return true;
        }
        
        const threshold_w = this.clip_w * 0.5;
        const threshold_h = this.clip_h * 0.5;

        return !(pos_x < this.min_x - threshold_w || pos_x > this.max_x + threshold_w || pos_y < this.min_y - threshold_h || pos_y > this.max_y + threshold_h);
    }

    update(pos_x, pos_y, ignore: {[id: string] : any}) {
        if (this.clip_tiles_draw) {
            this._queueDrawClip(pos_x, pos_y, ignore);
            this._drawQuqued(Math.log(this.queued + 1) * 8);
        } else {
            this._queueDraw(ignore);
            this._drawQuqued(this.queued + 1);
            return;
        }

       // remove random tiles outside bounds
       let picked = 0;
       const topick = Math.log(this.tiles.length + 1) * 10;
       let removed = 0;
       while(this.tiles.length && picked < topick && removed < 5) {
        picked += 1;
        const index = Math.floor(Math.random() * this.tiles.length);
        const tile = this.tiles[index];
        const pos_x = this.scene_map.entity_pos_x(tile.id);
        const pos_y = this.scene_map.entity_pos_y(tile.id);
        if (this.queue[tile.id]) {
            continue;
        }

        
        if (!this._isPosInClipbounds(pos_x, pos_y)) {
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
            }
        } 
       }
    }

    _drawQuqued(limit: number) {
       // add tiles from queue list
       let added = 0;
       for(const k in this.queue) {
        if (added++ > limit) {
            break;
        }
        const entity = this.queue[k];
        const pos_x = entity.components.model.properties.pos_x;
        const pos_y = entity.components.model.properties.pos_y;
        if (this._isPosInClipbounds(pos_x, pos_y)) {
            this.scene_map.addEntity(entity).then(() => this.tiles.push(entity))
        }
        delete this.queue[k];
        this.queued -= 1;
       }
    }

    _queueDraw(ignore: {[id: string] : any}, min_x?: number, min_y?: number, max_x?: number, max_y?: number) {
        for(const k in this.scene_map.tilesets) {
            const tileset = this.scene_map.tilesets[k];

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
                    entity.id = id;
                    const model = entity.components.model;
                    model.properties.pos_x = pos_x;
                    model.properties.pos_y = pos_y;
                }
               
                this.queue[id] = entity;
                this.queued += 1;
            }, 
            min_x, min_y, max_x, max_y);
        }
    }

    _queueDrawClip(pos_x, pos_y, ignore: {[id: string] : any}) {
        const clip_w = this.clip_w;
        const clip_h = this.clip_h;
        const x = Math.round(pos_x);
        const y = Math.round(pos_y);

        const threshold = 4;
        const min_x = x - clip_w;
        const min_y = y - clip_h;
        const max_x = x + clip_w;
        const max_y = y + clip_h;

        if (Math.abs((min_x + min_y + max_x + max_y) - (this.min_x + this.min_y + this.max_x + this.max_y)) < threshold) {
            return;
        }

        this.min_x = min_x;
        this.min_y = min_y;
        this.max_x = max_x;
        this.max_y = max_y;

        this._queueDraw(ignore, this.min_x, this.min_y, this.max_x, this.max_y);
    }
}