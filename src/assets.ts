function listenUploadsForm(form: HTMLFormElement | null) {
    if (!form) {
        throw new Error("form is null");
    }
    form.addEventListener("submit", submitForm);

    function submitForm(e) {
        e.preventDefault();
        if (!form) {
            throw new Error("form is null");
        }
        const files = form.querySelector('#assets_upload_files') as HTMLInputElement;
        const formData = new FormData();
        
        let len = files?.files?.length ?? 0;
        for(let i =0; i < len; i++) {
            let file = files?.files ? files?.files[i] : null;
            if(file) {
                formData.append("files", file);
            }
        }
        fetch("/assets/upload", {
            method: 'POST',
            body: formData,
            headers: {
              //"Content-Type": "multipart/form-data"
            }
        })
            .then((res) => console.log(res))
            .catch((err) => console.error(err));
    }
}

/**
 * starts to listen form "submit" and posts request on such
 * @param opts func options
 * @param opts.form form to work with
 * @param opts.url url path to post
 * @param opts.fields input names
 * @param opts.files file input names
 * @param callback callback of form response
 */
function listenFormSubmit(
    opts: { form: HTMLFormElement | null, url: string, fields?: Array<string> | null, files?: Array<string> | null },
    callback: (success: boolean, response: Response) => void
    ) {
    const form = opts.form;
    const url = opts.url;
    const fields = opts.fields;
    const files = opts.files;

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
        
        
        const res = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: {}
        })
        callback(res.ok, res);
    }
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
    id: string;
    type: string;
    extension: string;
}

class Asset {
    status: AssetStatus;
    info: AssetInfo;
    private _thumbnail: String | null;

    constructor(options: AssetInfo) {
        this.status = AssetStatus.UNKNOWN;
        this.info = options;
        this._thumbnail = null;
    }

    get thumbnail() : String {
        if (this._thumbnail) {
            return this._thumbnail;
        }

        let url = ""
        if (this.info.type.includes("image")) {
            url = this.info.url;
        }

        this._thumbnail = url;

        return this._thumbnail;
    }
}

class Assets {
    list: { [id: string] : Asset; };

    get(id: string) : Asset {
        const a = this.list[id];
        console.assert(a, `Asset ${id} wasn't found`);

        return a;
    }
    async loadAsset(id) {
        const path = "/assets/get/" + id;
        const res = await fetch(path);
        if(!res.ok) {
            console.error(`asset ${id} loading error`, res);
            throw new Error(`asset ${id} loading error`);
        }
        const data = await res.json();
        const myContentType = res.headers.get("Content-Type");
        const asset = new Asset({
            url: data.url,
            name: data.name,
            id: data.id,
            type: data.type,
            extension: data.extension
        });
        this.list[id] = asset;
    }

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
export { Assets, Asset, listenFormSubmit, listenUploadsForm }