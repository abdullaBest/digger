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

interface AssetInfo {
    url: string;
    name: string;
    tags: string;
    id: string;
    type: string;
    extension: string;
    revision: number;
    thumbnail: string | null;
}


interface AssetContentTypeComponent extends Matter {
    type: string;
}

interface AssetContentTypeCollider extends Matter {

}

interface AssetContentTypeModel extends AssetContentTypeComponent {
    gltf: string, 
    material: string, 
    texture: string, 
    matrix: Array<number> | null, 
    collider: boolean, 
    durability: string, 
    tags: string
}

interface AssetContentTypeTileset extends AssetContentTypeComponent {
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

    /**
     * Some assets (configs) may be bundled in one file. This value stores bundle id
     * not implemented for now
     */
    bundle: string | null;

    private _thumbnail: string | null;

    constructor(options: AssetInfo, id: string, bundle: string | null = null) {
        this.status = AssetStatus.UNKNOWN;
        this.info = options;
        this._thumbnail = null;
        this.id = id;
        this.bundle = bundle;
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

    private _base_content_extensions: { 
        component: AssetContentTypeComponent,
        model: AssetContentTypeModel, 
        tileset: AssetContentTypeTileset, 
        collider: AssetContentTypeCollider
    }

    constructor () {
        this.events = new Events();
        this.matters = new Matters();
    }

    init() {
        this.matters.init();

        const base_asset_extension_component = { type: "component" };
        const base_asset_extension_collider = { type: "collider", autosize: true };
        const base_asset_extension_model = { type: "model", gltf: "toset", material: "standart", texture: "toset", matrix: null }
        const base_asset_extension_tileset = { type: "tileset", guids: 0, texture: "toset", zero_color: "#ffffffff", tilesize_x: 1, tilesize_y: 1, default_tile: null }

        this._base_content_extensions = {
            component: this.matters.create(base_asset_extension_component, null, "base_asset_type_component") as AssetContentTypeComponent,
            model: this.matters.create(base_asset_extension_model, "base_asset_type_component", "base_asset_type_model") as AssetContentTypeModel,
            tileset: this.matters.create(base_asset_extension_tileset, "base_asset_type_component", "base_asset_type_tileset") as AssetContentTypeTileset,
            collider: this.matters.create(base_asset_extension_collider, "base_asset_type_component", "base_asset_type_collider") as AssetContentTypeCollider,
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

        const info = {
            url: data.url,
            name: data.name,
            id: data.id,
            type: data.type,
            extension: data.extension,
            revision: data.revision,
            tags: data.tags ?? "",
            thumbnail: data.thumbnail
        } as AssetInfo;

        const asset = new Asset(info, id);

        if (asset.info.type.includes("json")) {
            await asset.load();
            if (this.matters.get(id)) {
                asset.content = this.matters.replace(asset.content, id);
            } else {
                const inherites = asset.content.inherites ?? this._base_content_extensions[asset.info.extension]?.id;
                try {
                    asset.content = this.matters.create(asset.content, inherites, id, info.name);
                } catch(err) {
                    console.error(`Asset ${asset.id} creating error:`, err);
                }
            }
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
            try {
                await this.loadAsset(data[i]);
            } catch(err) {
                console.error(`Asset ${data[i]} loading error:`, err);
            }
        }
    }

    async uploadJSON(content: any, id: string, custom?: any) {
        const asset = this.get(id);

        const file = new File([JSON.stringify(content)], `v${asset.info.revision}_${asset.info.name}`, {
            type: "application/json",
        });

        const formData = new FormData();
        for(const k in custom) {
            formData.append(k, custom[k]);
        }
        formData.append("files", file);

        const res = await fetch(`/assets/upload/${asset.id}`, {
            method: 'POST',
            body: formData,
            headers: {}
        })
        await this.loadAsset(asset.id);
    }

    async createFiles(files: Array<File>) : Promise<Array<string>> {
        const res = await sendFiles("/assets/upload", files);
        const ids = await res.json();
        for(const i in ids) {
            const id = ids[i];
            await this.loadAsset(id);
        }

        return ids;
    }

    async createJSON(content: any, extension: string) : Promise<Array<string>> {
        const file = new File([JSON.stringify(content)], `new.${extension}`, {
            type: "application/json",
        });
       return this.createFiles([file]);
    }

    async wipeAsset(id: string) {
        if (this.matters.list[id]) {
            this.matters.remove(id);
        }
        const res = await fetch(`/assets/wipe/${id}`, {
            method: 'POST',
        });
        
        if (res.ok) {
            delete this.list[id];
        }
    }
}

export default Assets;
export { Assets, Asset, listenFormSubmit, sendFiles, AssetContentTypeComponent, AssetContentTypeModel }