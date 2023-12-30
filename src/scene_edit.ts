import { Assets, Asset, sendFiles } from "./assets";

/**
 * Used to override default asset properties with custom data
 */
class OverridedAssetLink {
    id: string;
    properties: any;
    constructor(id?, properties = {}) {
        this.id = id;
        this.properties = properties;
    }

    init(opts: {id: string, properties: any}) : OverridedAssetLink {
        this.id = opts.id;
        this.properties = Object.assign(this.properties, opts.properties);

        return this;
    }

    async load(url: string) {
        const data = await (await fetch(url)).json();
        Object.setPrototypeOf(this.properties, data);
    }

    store() {
        return {
            id: this.id,
            properties: this.properties
        }
    }
}

class SceneElement {
    parent: string | null;
    id: string;
    name: string;
    components: { [id: string] : OverridedAssetLink }

    constructor(id: string = '', name: string = 'newelement') {
        this.name = name;
        this.id = id;
        this.parent = null;
        this.components = {};
    }

    async load(assets: Assets) {
        for(const k in this.components) {
            const component = this.components[k]
            await component.load(assets.get(component.id).info.url);
        }
    }

    /**
     * initializes class properties from json
     * @param json stored data
     */
    init(json: any) : SceneElement {
        this.parent = json.parent;
        this.id = json.id;
        this.name = json.name;

        for(const k in json.components) {
            const component = json.components[k];
            this.components[k] = new OverridedAssetLink().init(component);
        }

        return this;
    }
    /**
     * Stores class properties into object
     * @param json object to store data in to
     */
    store(json: any): any {
        json.parent = this.parent;
        json.id = this.id;
        json.name = this.name;
        json.components = {};
       
        for(const k in this.components) {
            json.components[k] = this.components[k].store();
        }

        return json;
    }
}

class SceneEditUtils {
    static constructModelData(gltf: string, texture: string) {
        return { gltf, material: "standart", texture, matrix: null, collider: false }
    }

    static contructTilesetData(texture: string) {
        return { guids: 0, texture, zero_color: "0xffffff", color_id_prefix: "tile_color_", link_id_prefix: "tile_link_", tilesize_x: 1, tilesize_y: 1, default_tile: null }
    }
}

class SceneEdit {
    constructor(asset: Assets) {
        this.assets = asset;
        this.asset = null;
        this.guids = 0;
    }
    init() : SceneEdit {
        return this;
    }
    async load(id: string, reload = false) {
        if (!reload && this.asset?.info.id == id) {
            return;
        }
        
        this.elements = {};
        const asset = this.assets.get(id);
        if(!asset) { throw new Error(`can't load scene ${id}: no such asset`)}
        if(asset.info.extension != 'scene') { throw new Error(`can't load scene ${id}: asset has unproper extension (${asset.info.extension})`)}

        this.asset = asset;

        const res = await fetch(asset.info.url);
        const content = await res.json();

        this.guids = content.guids ?? 0;

        const elements = content.elements;
        for(const i in elements) {
            const el = elements[i];
            const element = new SceneElement().init(el)
            await element.load(this.assets);
            this.elements[el.id] = element;
        }
    }
    async save() {
        if (!this.asset) {
            return;
        }
        const json: {guids: number, elements: { [id: string] : SceneElement; }} = {guids: 0, elements: {}};
        json.guids = this.guids;
        for(const k in this.elements) {
            json.elements[k] = this.elements[k].store({})
        }

        const file = new File([JSON.stringify(json)], "newscene.scene", {
            type: "application/json",
        });
        const id = this.asset.info.id;
        sendFiles(`/assets/upload/${id}`, [file], (success, res) => {
            this.assets.loadAsset(id);
        });
    }

    async close(save: boolean = false) {
        if (save) {
            await this.save();
        }
        this.elements = {};
        this.asset = null;
    }

    async addElement(opts: {tileset?: string, model?: string, name?: string} = {}) : Promise<SceneElement> {
        const el = new SceneElement(this.asset?.info.id + '-e' + this.guids++);
        if(opts.model) {
            el.components.model = new OverridedAssetLink(opts.model);
        }
        if(opts.tileset) {
            el.components.tileset = new OverridedAssetLink(opts.tileset);
        }
        if(opts.name) {
            el.name = opts.name;
        }
        await el.load(this.assets);
        this.elements[el.id] = el;
        return el;
    }

    assets: Assets;
    asset: Asset | null;

    elements: { [id: string] : SceneElement; };
    guids: number;
}

export default SceneEdit;
export { SceneEdit, SceneElement, SceneEditUtils };