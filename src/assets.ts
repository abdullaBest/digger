import { Matters, Matter } from "./matters"
import Events from "./events";

/**
 * starts to listen form "submit" and posts request on such
 * @param opts func options
 * @param opts.form form to work with
 * @param opts.url url path to post
 * @param opts.fields input names
 * @param opts.files file input names
 * @param opts.custom custom content generators
 * @param callback callback of form response
 */
function listenFormSubmit(
    opts: { 
        form: HTMLFormElement | null, 
        url: string, 
        fields?: Array<string> | null, 
        files?: Array<string> | null, 
        custom?: { [id: string] : () => any }
    },
    callback: (success: boolean, response: Response) => void
    ) {
    const form = opts.form;
    const url = opts.url;
    const fields = opts.fields;
    const files = opts.files;
    const custom = opts.custom;

    if (!form) {
        throw new Error("form is null");
    }
    form.addEventListener("submit", submitForm);

    async function submitForm(e) {
        e.preventDefault();
        if (!form) {
            throw new Error("form is null");
        }

        const formData = new FormData();
        for(const i in fields) {
            const k = fields[i];
            const el = form.querySelector(`[name='${k}']`);
            if(!el) {
                continue;
            }

            formData.append(k, (el as HTMLInputElement).value);
        }

        for(const i in files) {
            const k = files[i];
            const f = form.querySelector(`[name='${k}']`) as HTMLInputElement;
            if(!f) {
                continue;
            }
            let len = f?.files?.length ?? 0;
            for (let i =0; i < len; i++) {
                let file = f?.files ? f?.files[i] : null;
                if(file) {
                    formData.append(k, file);
                }
            }
        }

        for(const k in custom) {
            const data = custom[k]();
            if (data) {
                formData.append(k, data);
            }
        }
        
        const res = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {}
        })
        callback(res.ok, res);
    }
}

async function sendFiles(url, files: Array<File>, callback?: (success: boolean, response: Response) => void) : Promise<Response> {
    const formData = new FormData();
    for(const i in files) {
        formData.append("files", files[i]);
    }
    const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {}
    })
    if(callback) {
        callback(res.ok, res);
    }

    return res;
}

enum AssetStatus {
    UNKNOWN = 0,
    ERROR = 1,
    LOADING = 2,
    LOADED = 3
}

interface AssetInfo extends Matter {
    url: string;
    name: string;
    tags: string;
    id: string;
    type: string;
    extension: string;
    revision: number;
    thumbnail: string | null;
}

interface AssetContentTypeModel extends Matter {
    gltf: string, 
    material: string, 
    texture: string, 
    matrix: Array<number> | null, 
    collider: boolean, 
    durability: string, 
    tags: string
}

interface AssetContentTypeTileset extends Matter {
    guids: 0, 
    texture: string, 
    zero_color: string, 
    color_id_prefix: string, 
    link_id_prefix: string, 
    durability_id_prefix: string, 
    tilesize_x: number, 
    tilesize_y: number, 
    default_tile: string | null
}

class Asset {
    status: AssetStatus;
    info: AssetInfo;
    content: any;
    id: string;
    private _thumbnail: string | null;

    constructor(options: AssetInfo, id: string) {
        this.status = AssetStatus.UNKNOWN;
        this.info = options;
        this._thumbnail = null;
        this.id = id;
    }

    /**
     * Loads asset content
     */
    async load() {
        this.status = AssetStatus.LOADING;
        const path = this.info.url;
        const id = this.info.id;

        const res = await fetch(path);
        if(!res.ok) {
            console.error(`asset ${id} loading error`, res);
            throw new Error(`asset ${id} loading error`);
        }

        if (this.info.type.includes("json")) {
            this.content = await res.json();
        }
        this.status = AssetStatus.LOADED;
    }

    get thumbnail() : string {
        if (this._thumbnail) {
            return this._thumbnail;
        }

        let url = ""
        if (this.info.thumbnail) {
            url = this.info.thumbnail;
        } else if (this.info.type.includes("image")) {
            url = this.info.url;
        }

        this._thumbnail = url;

        return this._thumbnail;
    }
}

class Assets {
    list: { [id: string] : Asset; };
    matters: Matters;
    events: Events;

    private _base_content_info: AssetInfo;
    private _base_content_extensions: { model: AssetContentTypeModel, tileset: AssetContentTypeTileset }

    init() {
        this.events = new Events();
        this.matters = new Matters();
        this.matters.init();

        const base_asset_info = {
            id: "base_asset_info",
            name: "base_asset_info",
            url: "http",
            tags: "base,config",
            type: "info",
            extension: "config",
            revision: 0,
            thumbnail: "http"
        }

        const base_asset_extension_model = { gltf: "toset", material: "standart", texture: "toset", matrix: null, collider: false, durability: "0x00", tags: "" }
        const base_asset_extension_tileset = { guids: 0, texture: "toset", zero_color: "0xffffffff", color_id_prefix: "tile_color_", link_id_prefix: "tile_link_", durability_id_prefix: "tile_durablity_", tilesize_x: 1, tilesize_y: 1, default_tile: null }

        this._base_content_info = this.matters.create(base_asset_info) as AssetInfo;

        this._base_content_extensions = {
            model: this.matters.create(base_asset_extension_model, null, "base_asset_type_model") as AssetContentTypeModel,
            tileset: this.matters.create(base_asset_extension_tileset, null, "base_asset_type_tileset") as AssetContentTypeTileset,
        };

    }

    get(id: string) : Asset {
        const asset = this.list[id] ?? null;

        if (!asset) { throw new Error("Assets: can't find asset " + id) }

        return asset;
    }

    /**
     * @param filter regexp match or strict match 
     * @returns 
     */
    find(filter: {[id: string] : string | RegExp}) : { [id: string] : Asset; } {
        const assets = {};
        for(const id in this.list) {
            if (this.filter(id, filter)) { assets[id] = this.get(id) }
        }

        return assets;
    }

    /**
     * 
     * @param id asset id
     * @param filter regexp match or strict string match 
     * @returns true if asset matches all filters
     */
    filter(id: string, filter: {[id: string] : string | RegExp}) : boolean {
        const asset = this.get(id);

        let filtered = false;
        for(const k in filter) {
            if(!(k in asset.info)) {
                continue;
            }
            const regexp_check = typeof(asset.info[k]) == "string" && typeof(filter[k]) == "object";
            if ((regexp_check && !asset.info[k].match(filter[k])) || (!regexp_check && asset.info[k] != filter[k])) {
                filtered = true;
                break;
            }
        }

        return !filtered;
    }

    /**
     * Loads asset metadata + asset content if it json type
     * @param onprogress callbacks on asset loaded
     */
    async loadAsset(id: string) {
        const path = "/assets/get/" + id;
        const res = await fetch(path);
        if(!res.ok) {
            console.error(`asset ${id} loading error`, res);
            throw new Error(`asset ${id} loading error`);
        }
        const data = await res.json();
        //const myContentType = res.headers.get("Content-Type");

        const info = this.matters.create({
            url: data.url,
            name: data.name,
            id: data.id,
            type: data.type,
            extension: data.extension,
            revision: data.revision,
            tags: data.tags ?? "",
            thumbnail: data.thumbnail
        }, this._base_content_info.id, id) as AssetInfo;

        const asset = new Asset(info, id);

        if (asset.info.type.includes("json")) {
            await asset.load();
            asset.content = this.matters.create(asset.content, this._base_content_extensions[asset.info.extension]?.id, id + "-content", info.name);
        }

        this.list[id] = asset;
        this.events.emit("asset", { id });
    }

    /**
     * 
     * @param onprogress callbacks on asset loaded
     */
    async load() {
        const res = await fetch("/assets/list");
        if (!res.ok) {
            console.error("Assets loading error", res);
            throw new Error("Assets loading error");
        }
        this.list = {};
        const data = await res.json();
        for (const i in data) {
            await this.loadAsset(data[i]);
        }
    }
}

export default Assets;
export { Assets, Asset, listenFormSubmit, sendFiles }