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

async function sendFiles(url, files?: Array<File>, custom?: any, callback?: (success: boolean, response: Response) => void) : Promise<Response> {
    const formData = new FormData();
    for(const i in files) {
        formData.append("files", files[i]);
    }
    for(const k in custom) {
        formData.append(k, custom[k]);
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
}


interface AssetContentTypeComponent extends Matter {
    type: string;
    /**
     * Used to indicate that componet attached to another component and should not be listed in global scope
     */
    owner?: string | null;

    /**
     * Indicates that component should not be added into scene tree
     */
    abstract?: boolean | null;
}

interface AssetContentTypeCollider extends AssetContentTypeComponent {

}

interface AssetContentTypeSpace extends AssetContentTypeComponent {
    guids: number;
}

interface AssetContentTypeTexture extends AssetContentTypeComponent {
    asset: HTMLImageElement;
    url: string;
}

interface AssetContentTypeModel extends AssetContentTypeComponent {
    gltf: string, 
    material: string, 
    texture: string, 
    matrix?: Array<number> | null, 
    pos_x?: number | null,
    pos_y?: number | null,
}

interface AssetContentTypeTileset extends AssetContentTypeComponent {
    guids: 0, 
    texture: string, 
    zero_color: string, 
    color_id_prefix: string, 
    link_id_prefix: string, 
    durability_id_prefix: string, 
    tilesize_x: number, 
    tilesize_y: number
    pos_x: number;
    pos_y: number;
}

interface AssetContentTypeTile extends AssetContentTypeComponent {
    color: string;
    link: string;
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
        } else if (this.info.type.includes("image")) {
            const cache = document.querySelector("db#cache");
            const elid = "#asset_img-" + id;
            const img = (cache?.querySelector(elid) ?? document.createElement("img")) as HTMLImageElement;
            if (!img.parentElement) {
                cache?.appendChild(img);
                img.id = elid;
                img.src = path;
            }

            this.content = {
                asset: img,
                url: this.info.url
            }
        }

        if (this.info.extension == "gltf") {
            this.content = this.content || {};
            this.content.url = this.info.url;
        }

        this.status = AssetStatus.LOADED;
    }

    get thumbnail() : string {
        if (this._thumbnail) {
            return this._thumbnail;
        }

        let url = ""
        if (this.info.type.includes("image")) {
            url = this.info.url;
        } else {
            url = "/assets/load/thumbnail/" + this.id;
        }
       
        this._thumbnail = url;

        return this._thumbnail;
    }
}

class Assets {
    list: { [id: string] : Asset; };
    
    // Asset wich stores all components
    bundles: { [id: string] : Asset; };

    matters: Matters;
    events: Events;

    private _base_content_extensions: { 
        component: AssetContentTypeComponent,
        space: AssetContentTypeSpace,
        texture: AssetContentTypeTexture,
        model: AssetContentTypeModel, 
        tileset: AssetContentTypeTileset,
        tile: AssetContentTypeTile,
        collider: AssetContentTypeCollider
    }

    constructor () {
        this.events = new Events();
        this.matters = new Matters();
    }

    init() {
        this.matters.init();

        const base_asset_extension_component = { type: "component" };
        const base_asset_extension_space = { type: "space", guids: 0 };
        const base_asset_extension_texture = { type: "texture", asset: null };
        const base_asset_extension_collider = { type: "collider", autosize: true };
        const base_asset_extension_model = { type: "model", gltf: "toset", material: "standart", texture: "toset", matrix: null }
        const base_asset_extension_tileset = { type: "tileset", texture: "toset", zero_color: "#ffffffff", tilesize_x: 1, tilesize_y: 1, pos_x: 0, pos_y: 0 }
        const base_asset_extension_tile = { type: "tile", color: "#000000", link: "toset", abstract: true };

        this._base_content_extensions = {
            component: this.matters.create(base_asset_extension_component, null, "base_asset_type_component") as AssetContentTypeComponent,
            space: this.matters.create(base_asset_extension_space, "base_asset_type_component", "base_asset_type_space") as AssetContentTypeSpace,
            texture: this.matters.create(base_asset_extension_texture, "base_asset_type_component", "base_asset_type_texture") as AssetContentTypeTexture,
            model: this.matters.create(base_asset_extension_model, "base_asset_type_component", "base_asset_type_model") as AssetContentTypeModel,
            tileset: this.matters.create(base_asset_extension_tileset, "base_asset_type_component", "base_asset_type_tileset") as AssetContentTypeTileset,
            tile: this.matters.create(base_asset_extension_tile, "base_asset_type_component", "base_asset_type_tile") as AssetContentTypeTile,
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

        const asset = this._createAsset(data);
        await asset.load();
        this._initAsset(asset, asset.content);
    }

    _createAsset(info: AssetInfo) : Asset {
        const _info = {
            url: info.url,
            name: info.name,
            id: info.id,
            type: info.type,
            extension: info.extension,
            revision: info.revision,
            tags: info.tags ?? "",
        } as AssetInfo;

        const asset = new Asset(_info, _info.id);
        this.list[_info.id] = asset;

        return asset;
    }

    _initAsset(asset: Asset, content?: any | null) : Matter {
        if (content) {
            this.parseAssetContent(asset, content);
        }
        this.events.emit("asset", { id: asset.id });

        return asset.content;
    }

    /**
     * Uber function that handles all asset types
     * 
     * @param asset 
     * @returns 
     */
    private parseAssetContent(asset: Asset, content?: any | null) {
        // A. bundle
        if (asset.info.extension == "bundle") {
            const name = asset.info.name.split(".").shift() ?? asset.info.name;
            for(const k in content.list) {
                const c = content.list[k];
                const id = c.id ?? k;
                //const name = c.name ?? `${asset.info.name}-${id}`;
                const _asset = this._createAsset(content.infos[id]);
                _asset.bundle = name;
                content.list[k] = this._initAsset(_asset, c);
            }

            this.bundles[name] = asset;

            return;
        }

        // B. Single asset content
        // a. replacing existing matter (any kind of reloading)
        if (this.matters.get(asset.id)) {
            asset.content = this.matters.replace(content, asset.id);
            return;
        } 
        
        // b. creating new matter
        const inherites = content.inherites ?? this._base_content_extensions[asset.info.extension]?.id;
        try {
            asset.content = this.matters.create(content, inherites, asset.id, asset.info.name);
        } catch(err) {
            console.error(`Asset ${asset.id} creating error:`, err);
        }
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
        this.bundles = {};
        const data = await res.json();
        for (const i in data) {
            try {
                await this.loadAsset(data[i]);
            } catch(err) {
                console.error(`Asset ${data[i]} loading error:`, err);
            }
        }
    }

    async uploadAsset(id: string, files?: Array<File>, custom?: any) {
        const res = await sendFiles(`/assets/upload/${id}`, files, custom);
        await this.loadAsset(id);
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
    
    async uploadJSON(content: any, id: string, custom?: any) {
        const asset = this.get(id);

        const file = new File([JSON.stringify(content)], `v${asset.info.revision}_${asset.info.name}`, {
            type: "application/json",
        });

        await this.uploadAsset(id, [file], custom);
    }

    async createJSON(content: any, extension: string, name: string = `new`) : Promise<Array<string>> {
        const file = new File([JSON.stringify(content)], name + "." + extension, {
            type: "application/json",
        });

       return this.createFiles([file]);
    }

    async uploadComponent(content: any, extension: string, bundle_name?: string | null, name?: string) : Promise<string> {
        bundle_name = bundle_name ??  "base_bundle";
        if (!this.bundles[bundle_name]) {
            const bundle = {
                guids: 0,
                list: {},
                infos: {}
            }
            // now it will be handled by loadAsset function and base_bundle will be initialized
            await this.createJSON(bundle, "bundle", bundle_name);
        }

        const bundle = this.bundles[bundle_name];
        if (!bundle) {
            throw new Error("Assets::uploadComponent unexpected error. Should not be like that.");
        }

        const id = bundle.content.list[content.id]?.id ?? `${bundle.id}-c${bundle.content.guids++}`;
        name = name ?? content.name ?? `new-${id}.${extension}`;
        content.id = id;
        bundle.content.list[id] = content;
        let _info = bundle.content.infos[id];
        if (!bundle.content.infos[id]) {
            _info = {
                url: bundle.info.url,
                name: name,
                id: id,
                type: bundle.info.type,
                extension: extension,
                revision: -1,
                tags: bundle.info.tags ?? ""
            } as AssetInfo;
            bundle.content.infos[id] = _info;
        }

        _info.revision += 1;
        _info.name = name;

        await this.uploadJSON(bundle.content, bundle.id);

        return id;
    }

    async wipeAsset(id: string) {
        if (this.matters.list[id]) {
            this.matters.remove(id);
        }

        const asset = this.get(id);
        if (asset.bundle) {
            const bundle = this.bundles[asset.bundle];
            delete bundle.content.infos[id];
            delete bundle.content.list[id];
            await this.uploadJSON(bundle.content, bundle.id);

            delete this.list[id];
            return;
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
export { Assets, Asset, listenFormSubmit, sendFiles, AssetContentTypeComponent, AssetContentTypeModel, AssetContentTypeTileset, AssetContentTypeTile, AssetContentTypeTexture }