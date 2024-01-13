import * as THREE from '../lib/three.module.js';
import { Assets } from '../assets.js'
import SceneRenderCache from './scene_render_cache.js'
import SceneRenderLoader from './scene_render_loader.js';
import { SceneEditUtils } from "../scene_edit.js";

interface TilesetCacheData {
    models_bycolor: { [id: number] : any };
    models: { [id: number] : string };
    tiles: Array<string>;
}

export default class TilesetRender {
    assets: Assets;
    cache: SceneRenderCache;
    loader: SceneRenderLoader;
    cache_tilesets: { [id: string] : TilesetCacheData }

    constructor(assets: Assets, cache: SceneRenderCache, loader: SceneRenderLoader) {
        this.assets = assets;
        this.cache = cache;
        this.loader = loader;
        this.cache_tilesets = {};
    }

    async registerTileset(id: string, tileset: any) {
        const color_id_prefix = tileset.color_id_prefix;
        const link_id_prefix = tileset.link_id_prefix;
        const durability_id_prefix = tileset.durability_id_prefix;

        let default_tile_data: any = null;
        if (tileset.default_tile) {
            default_tile_data = await (await fetch(this.assets.get(tileset.default_tile).info.url)).json();
        }

        const list = {
            models_bycolor: {},
            models: {},
            tiles: []
        }
        this.cache_tilesets[id] = list;

        // generate tileset list
        for (let i = 0; i < tileset.guids; i++) {
            const color_id = color_id_prefix + i;
            const link_id = link_id_prefix + i;
            const durability_id = durability_id_prefix + i;
            let color = tileset[color_id];
            const link = tileset[link_id];
            const durability = tileset[durability_id];

            if (!color) {
                console.warn(`SceneRender::addTileset error - no color set. color: (${color})`);
                continue;
            }
            if (!link && !tileset.default_tile) {
                console.warn(`SceneRender::addTileset error - no link or default tile set. link: (${link})`);
                continue;
            }

            if (!color.includes("0x")) {
                throw new Error(`SceneRender::addTileset error - wrong color "${color}" format. It should start with "0x"`);
            }
            if (color.length != "0x00000000".length) {
                color += "ff";
            }
            if (color.length != "0x00000000".length) {
                throw new Error(`SceneRender::addTileset error - wrong color "${color}" length. It should be like "0x000000" (RGB) or "0x00000000" (RGBA)`);
            }

            const linkinfo = this.assets.get(link).info;
            let model;
            if (linkinfo.extension == "png") {
                if (!tileset.default_tile || !default_tile_data) {
                    console.warn(`SceneRender::addTileset error - using tile texture link without default_tile set`);
                    continue;
                }
                model = SceneEditUtils.constructModelData(default_tile_data.gltf, link);
                model.matrix = default_tile_data.matrix;
                model.collider = default_tile_data.collider;
            } else {
                model = await (await fetch(linkinfo.url)).json();
            }

            model.durability = durability;

            const modelid = `${id}-tileref-${i}`;
            const colorid = parseInt(color)
            list.models_bycolor[colorid] = model;
            list.models[modelid] = model;
        }

        // preload
        const p: Array<Promise<any>> = [];
        for(const k in list.models) {
            p.push(this.loader.getModel(k, list.models[k]));
        }

        await Promise.all(p);
    }

    disposeTileset(id: string) {
        const tileset = this.cache_tilesets[id];
        if(tileset) {
            while(tileset.tiles.length) {
                this.loader.unloadModel(tileset.tiles.pop() as any);
            }

            for(const k in tileset.models) {
                this.loader.unloadModel(k/*, true*/);
            }
        }

        delete this.cache_tilesets[id];
    }

    async drawTileset(id: string, tileset: any, onmodel: (model: any, id: string, obj: THREE.Object3D) => void) : Promise<THREE.Group> {
        const group = new THREE.Group()
        const list = this.cache_tilesets[id];
        // extract image tileset data
        const loadimg = (url) => {
            const img = document.createElement("img");
            return new Promise((resolve, reject) => {
                img.src = url;
                img.onload = (ev) => resolve(ev.target);
                img.onerror = reject;
            })
        }
        const img = await loadimg(this.assets.get(tileset.texture).info.url) as HTMLImageElement;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const imgdata = ctx?.getImageData(0, 0, img.width,  img.height).data;

        if (!imgdata) {
            throw new Error("SceneRender::addTileset error - no image data");
        }

        // parse image tileset
        const unused_colors: Array<number> = [];
        let guids = 0;
        for(let i = 0; i < imgdata.length && this.cache_tilesets[id]; i += 4) {
            const r = imgdata[i] & 0xFF;
            const g = imgdata[i + 1] & 0xFF;
            const b = imgdata[i + 2] & 0xFF;
            const a = imgdata[i + 3] & 0xFF;
            const color = (r<< 24 >>>0) + (g<<16) + (b<<8) + (a<<0);

            const model = list.models_bycolor[color];
            if (!model) {
                if (parseInt(tileset.zero_color) != color && !unused_colors.find((c) => c != color)) {
                    unused_colors.push(color);
                }
                continue;
            }

            // add meshes
            const pos_x = ((i / 4) % canvas.width) * tileset.tilesize_x;
            const pos_y = -Math.floor((i / 4) / canvas.width) * tileset.tilesize_y;
            const modelid = `${id}-tile-${guids++}`;

            const obj = await this.loader.getModel(modelid, model);
            group.add(obj);

            // something deleted tileset durning loading
            if (!this.cache_tilesets[id]) {
                this.loader.unloadModel(modelid);
                break;
            }

            list.tiles.push(modelid);

            (obj as any).position.set(pos_x , pos_y, 0)
            onmodel(model, modelid, obj);
        }

        for(const i in unused_colors) {
            console.warn(`SceneRender::addTileset ref texture has color 0x${unused_colors[i].toString(16).padStart(8, "0")} which does not have tile for that.`);
        }

        return group;
    }
}