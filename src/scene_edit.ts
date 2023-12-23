import { Assets, Asset, sendFiles } from "./assets";

class SceneElement {
    parent: string | null;
    id: string;
    name: string;
    position: { x:number, y: number, z: number };
    model: string | null;

    constructor(id: string = '', name: string = 'newelement') {
        this.name = name;
        this.id = id;
        this.parent = null;
        this.position = {x: 0, y: 0, z: 0};
    }

    /**
     * initializes class properties from json
     * @param json stored data
     */
    init(json: any) : SceneElement {
        this.parent = json.parent;
        this.id = json.id;
        this.name = json.name;
        if (json.position) {
            Object.assign(this.position, json.position);
        }
        console.log(json.position, this.position);
        if (json.model) {
            this.model = json.model;
        }

        return this;
    }
    /**
     * Stores class properties into object
     * @param json object to store data in to
     */
    store(json: any): object {
        json.parent = this.parent;
        json.id = this.id;
        json.name = this.name;
        if (this.position) {
             json.position = Object.assign(json.position ?? {}, this.position);
        }
        console.log(json.position, this.position);
        if (this.model) {
            json.model = this.model;
       }

        return json;
    }
}

export default class SceneEdit {
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
            this.elements[el.id] = element;
        }
    }
    async save() {
        const json: {guids: number, elements: { [id: string] : SceneElement; }} = {guids: 0, elements: {}};
        json.guids = this.guids;
        for(const k in this.elements) {
            json.elements[k] = this.elements[k].store({})
        }

        const file = new File([JSON.stringify(json)], "newscene.scene", {
            type: "application/json",
        });
        const id = this.asset?.info.id;
        sendFiles(`/assets/upload/${id}`, [file], (success, res) => {
            this.assets.loadAsset(id);
        });
    }

    addElement(opts: {model?: string, name?: string} = {}) : SceneElement {
        const el = new SceneElement('e' + this.guids++);
        if(opts.model) {
            el.model = opts.model;
        }
        if(opts.name) {
            el.name = opts.name;
        }
        this.elements[el.id] = el;
        return el;
    }

    assets: Assets;
    asset: Asset | null;

    elements: { [id: string] : SceneElement; };
    guids: number;
}