import { Matters } from "./matters"

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

class Asset {
    status: AssetStatus;
    info: AssetInfo;
    private _thumbnail: string | null;

    constructor(options: AssetInfo) {
        this.status = AssetStatus.UNKNOWN;
        this.info = options;
        this._thumbnail = null;
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

    init() {
        this.matters = new Matters();
        this.matters.init();
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
     * Loads asset metadata. To get asset data itself use asset.info.url
     * @param onprogress callbacks on asset loaded
     */
    async loadAsset(id: string, onprogress?: (id: string) => void) {
        const path = "/assets/get/" + id;
        const res = await fetch(path);
        if(!res.ok) {
            console.error(`asset ${id} loading error`, res);
            throw new Error(`asset ${id} loading error`);
        }
        const data = await res.json();
        //const myContentType = res.headers.get("Content-Type");
        const asset = new Asset({
            url: data.url,
            name: data.name,
            id: data.id,
            type: data.type,
            extension: data.extension,
            revision: data.revision,
            tags: data.tags ?? "",
            thumbnail: data.thumbnail
        });
        this.list[id] = asset;
        if(onprogress) {
            onprogress(id);
        }
    }

    /**
     * 
     * @param onprogress callbacks on asset loaded
     */
    async load(onprogress?: (id: string) => void) {
        const res = await fetch("/assets/list");
        if (!res.ok) {
            console.error("Assets loading error", res);
            throw new Error("Assets loading error");
        }
        this.list = {};
        const data = await res.json();
        for (const i in data) {
            await this.loadAsset(data[i], onprogress);
        }
    }
}

export default Assets;
export { Assets, Asset, listenFormSubmit, sendFiles }