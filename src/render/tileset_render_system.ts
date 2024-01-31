import { SceneCore } from '../scene_core';
import { MapTilesetSystem, MapSystem } from '../systems';
import { AssetContentTypeComponent, AssetContentTypeTileset } from '../assets';
import { Matters } from '../matters';

class TilesetRender {
    scene_core: SceneCore;
    map_tileset_system: MapTilesetSystem;
    matters: Matters;

    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;

    clip_tiles_draw: boolean;

    // all tiles that currently on scene
    tiles: { [id: string] : Array<AssetContentTypeComponent> };
    // tile add queue
    queue: { [id: string] : AssetContentTypeComponent }
    queued: number;
    // removed tiles that can be reused
    dump: { [id: string] : Array<AssetContentTypeComponent> }
    // removed tiles that gonna be restored as it was (preserved)
    dump_exact: { [id: string] : AssetContentTypeComponent };

    clip_w: number;
    clip_h: number;

    constructor(scene_core: SceneCore, map_tileset_system: MapTilesetSystem) {
        this.scene_core = scene_core;
        this.map_tileset_system = map_tileset_system;
        this.matters = this.scene_core.matters;

        this.clip_h = 16;
        this.clip_w = 16;
        this.queued = 0;
        this.clip_tiles_draw = true;
    }

    init() {
        this.cleanup();
    }

    cleanup() {
        this.queue = {};
        for(const k in this.tiles) {
            this.cleanupTileset(k);
        }
        
        this.tiles = {};
        this.dump = {};
        this.dump_exact = {};
        
        this.resetThreshold();
    }

    _isPosInClipbounds(pos_x: number, pos_y: number) {
        if (!this.clip_tiles_draw) {
            return true;
        }
        
        const threshold_w = this.clip_w * 0.5;
        const threshold_h = this.clip_h * 0.5;

        return !(pos_x < this.min_x - threshold_w || pos_x > this.max_x + threshold_w || pos_y < this.min_y - threshold_h || pos_y > this.max_y + threshold_h);
    }

    resetThreshold() {
        this.min_x = -Infinity;
        this.min_y = -Infinity;
        this.max_x = Infinity;
        this.max_y = Infinity;
    }

    update(pos_x, pos_y, ignore?: {[id: string] : any}) {
        let draw_count = 0;
        if (this.clip_tiles_draw) {
            this._queueDrawClip(pos_x, pos_y, ignore);
            draw_count = Math.log(this.queued + 1) * 8;
        } else {
            this._queueDraw(ignore);
            draw_count = this.queued + 1;
            return;
        }

        for(const k in this.map_tileset_system.tilesets) {
            this._drawQuqued(k, draw_count);
        }

        for(const k in this.tiles) {
            this.cleanupTiles(this.tiles[k]);
        }
    }

    cleanupTileset(tileset: string) {
        const tiles = this.tiles[tileset];
        while(tiles?.length) {
            const tile = tiles.shift();
            if (tile) {
                this.scene_core.remove(tile.id);
            }
        }
        
        this.resetThreshold();
    }

    cleanupTiles(tiles: Array<AssetContentTypeComponent>) {
        // remove random tiles outside bounds
        let picked = 0;
        const topick = Math.log(tiles.length + 1) * 16;
        let removed = 0;
        while(this.tiles.length && picked < topick && removed < topick * 0.5) {
        picked += 1;
        const index = Math.floor(Math.random() * tiles.length);
        const tile = tiles[index];
        const pos_x = this.scene_core.entity_pos_x(tile.id);
        const pos_y = this.scene_core.entity_pos_y(tile.id);
        if (this.queue[tile.id]) {
            continue;
        }
        
        if (!this._isPosInClipbounds(pos_x, pos_y)) {
            this.scene_core.remove(tile.id);
            //remove from array
            const b = tiles[0];
            tiles[index] = b;
            tiles.shift();
            removed += 1;

            if (false && tile.inherites) {
                // save entity into dump
                // a. save into exact list - gonna be restored as it was
                // b. save into dump array - just saves some memory operations
                if (tile.persist) {
                    this.dump_exact[tile.id] = tile;
                } else {
                    let arr = this.dump[tile.inherits]
                    if (!arr) {
                        arr = this.dump[tile.inherits] = [];
                    }
                    arr.push(tile);
                }
            }
        } 
        }
    }

    _drawQuqued(tileset: string, limit: number) {
       // add tiles from queue list
       let added = 0;
       for(const k in this.queue) {
        if (added++ > limit) {
            break;
        }
        const tile = this.queue[k];
        const pos_x = tile.pos_x;
        const pos_y = tile.pos_y;
        if (this._isPosInClipbounds(pos_x, pos_y)) {
            this.scene_core.add(tile).then((id) => {
                if (!id) {
                    return;
                }
                if (!this.tiles[tileset]) {
                    this.tiles[tileset] = [];
                }
                this.tiles[tileset].push(this.scene_core.matters.get(id) as AssetContentTypeComponent);
            })
        }
        delete this.queue[k];
        this.queued -= 1;
       }
    }

    _queueDraw(ignore?: {[id: string] : any}, min_x?: number, min_y?: number, max_x?: number, max_y?: number) {
        for(const k in this.map_tileset_system.tilesets) {
            const tileset = this.map_tileset_system.tilesets[k];

            tileset.propagate((ref_id: string, id: string, pos_x: number, pos_y: number) => {
                if (this.scene_core.components[id] || (ignore && id in ignore) || this.queue[id]) {
                    return;
                }
                const ref = this.matters.get(tileset.components[ref_id]) as AssetContentTypeComponent;
                const entity = this.makeTileEntity(ref, id, pos_x, pos_y);
                this.queue[id] = entity;
                this.queued += 1;
            }, 
            min_x, min_y, max_x, max_y);
        }
    }

    makeTileEntity(ref: AssetContentTypeComponent, id: string, pos_x: number, pos_y: number) {
        let component = this.dump_exact[id] ?? this.dump[ref.id]?.pop();
        if (!component) {
            component = this.matters.create({ pos_x, pos_y }, ref.id, id) as AssetContentTypeComponent;
        } else if (this.dump_exact[id]) {
           delete this.dump_exact[id];
        } else {
            component.id = id;
            component.pos_x = pos_x;
            component.pos_y = pos_y;
        }


        return component;
    }

    _queueDrawClip(pos_x, pos_y, ignore?: {[id: string] : any}) {
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

class RenderTilesetSystem extends MapSystem {
    scene_core: SceneCore;
    tileset_render: TilesetRender;
    constructor(scene_core: SceneCore) {
        super();

        this.scene_core = scene_core;
        this.tileset_render = new TilesetRender(this.scene_core, this.scene_core.systems.tileset as MapTilesetSystem);
        this.tileset_render.init();
    }

    filter(component: AssetContentTypeTileset) : boolean {
        return component.type == "tileset";
    }

    async add(component: AssetContentTypeTileset, owner?: AssetContentTypeComponent) {
        if (!this.filter(component)) {
            return;
        }

        this.tileset_render.update(0, 0);
        this.tileset_render.resetThreshold();
    }

    remove(component: AssetContentTypeTileset) {
        if (!this.filter(component)) {
            return;
        }
        this.tileset_render.cleanupTileset(component.id);
    }
}

export default TilesetRender;
export { TilesetRender, RenderTilesetSystem }
