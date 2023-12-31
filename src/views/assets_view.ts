import { Assets, listenFormSubmit } from "../assets";
import SceneRender from "../scene_render";
import { sprintf } from "../lib/sprintf.js";
import { listenClick, reattach, switchPage, querySelector, popupListSelect } from "../document";

/**
 * v1: draws property edit with select option
 */
class AssetPropertyEdit {
    /**
     * @param object object to chenge property in
     * @param key key in object to access
     * @returns this
     */
    init(object: any, key: string, callback?: (value: string | boolean | number) => void) : AssetPropertyEdit {
        this.object = object;
        this.key = key;
        this.callback = callback ?? null;
        
        return this;
    }

    drawSelectOption(onclick: () => Promise<string>, parent?: HTMLElement) : HTMLElement {
        this.element = this.element ?? document.createElement("entry");
        const value = this.object[this.key];
        this.element.innerHTML = `<label title="${value}">${this.key}:(${value})<btn>set</btn></label>`
        this.element.querySelector("btn")?.addEventListener('click', async () => {
            const newval = await onclick();
            this.object[this.key] = newval;
            this.drawSelectOption(onclick, parent);
            if (this.callback) {
                this.callback(newval);
            }
        });

        if (!this.element.parentElement) {
            parent?.appendChild(this.element);
        }

        return this.element;
    }

    drawTextEditOption(parent?: HTMLElement, type: string = "text") : HTMLElement {
        this.element = this.element ?? document.createElement("entry");
        this.element.innerHTML = `<label>${this.key}<input value="${this.object[this.key]}", type="${type}" name="name"></input></label>`
        this.element.querySelector("input")?.addEventListener('change', async (ev) => {
            const newval = (ev.target as HTMLInputElement)?.value;
            this.object[this.key] = newval;
            if (this.callback) {
                this.callback(newval);
            }
        });

        if (!this.element.parentElement) {
            parent?.appendChild(this.element);
        }

        return this.element;
    }

    drawCkeckboxOption(parent?: HTMLElement) : HTMLElement {
        this.element = this.element ?? document.createElement("entry");
        this.element.innerHTML = `<label>${this.key}<input ${this.object[this.key] ? "checked" : ""} type="checkbox" name="name"></input></label>`
        this.element.querySelector("input")?.addEventListener('change', async (ev) => {
            const newval = (ev.target as HTMLInputElement)?.checked;
            this.object[this.key] = newval;
            if (this.callback) {
                this.callback(newval);
            }
        });

        if (!this.element.parentElement) {
            parent?.appendChild(this.element);
        }

        return this.element;
    }

    object: any;
    key: string;
    element: HTMLElement | null;
    callback: ((value: string | boolean | number) => void) | null;
}

class AssetsView {
    constructor(assets: Assets, scene: SceneRender){
        this.assets = assets;
        this.scene_render = scene;
    }

    /**
     * @param list_container container that hold whole assets list
     * @param props_container container that displays particular asset properties
     * @returns this
     */
    init(list_container: HTMLElement | null, props_container: HTMLElement | null) : AssetsView {
        if(!list_container) throw new Error("AssetsView init error: argument list_container is null");
        if(!props_container) throw new Error("AssetsView init error: argument props_container is null");

        this.list_container = list_container;
        this.props_container = props_container;

        this.list_container.addEventListener('click', (ev) => {
            const id = (ev.target as HTMLElement).id;
            if(id) {
                this.drawDetails(id);
            }
        });

        return this;
    }

    private async drawDetails(id: string) {
        const asset = this.assets.get(id);
        if(!asset) {
            return;
        }
        console.log("Preview asset:", asset);
        const info = asset.info;

		const template = document.querySelector("template#asset_details_template")?.innerHTML;
		if(!template) {
			throw new Error("Couldn't find template#asset_details_template");
		}
        this.props_container.innerHTML = sprintf(template, info.name, info.extension, info.extension);

        this.props_container.querySelector("label#assets_upload_files_label")?.classList[info.extension.includes("model") ? "add" : "remove"]('hidden');
        const asset_preview = querySelector("container#asset_preview_container");
        asset_preview.classList.remove("hidden");

        // draw previews
        if (info.extension == "gltf" || info.extension == "glb" || info.extension == 'model' || info.extension == "scene") {
			const container = switchPage("#canvas_asset_preview");
            reattach(querySelector("#scene_edit_tools"), container);
            this.scene_render.reattach(container as HTMLElement);
            this.scene_render.clearModels();
            if (info.extension == 'model') {
               // ...
            } else if (info.extension == 'scene') {
                await this.scene_render.scene_edit.load(id);
                for(const _id in this.scene_render.scene_edit.elements) {
                    const element = this.scene_render.scene_edit.elements[_id];
        
                    if(element.components.model) {
                        this.scene_render.addModel(_id, element.components.model.properties);
                    }
                }
            } 
            else {
                this.scene_render.viewGLTF(info.url);
            }
        } else if (info.type.includes("image")) {
			const container = switchPage("#img_asset_preview");
			const img = querySelector("img") as HTMLImageElement;
			img.src = asset.thumbnail;
		} 
        
        let json_data_changed = false;
        let asset_json: any = null;
        const makeJSONFile = () => {
            if (!(json_data_changed || asset_json?.matrix)) {
                return null;
            }
            const file = new File([JSON.stringify(asset_json)], `v${info.revision}_${info.name}`, {
                type: "application/json",
            });

            return file;
        }

        // draw settings fiels
        if (info.extension == "model") {
            //const model = await (await fetch(this.assets.get(id).info.url)).json();
            asset_json = await (await fetch(info.url)).json();
            this.scene_render.viewModel(id, asset_json);
            const container = switchPage("#details_model_edit");
            container.innerHTML = "";
            this._drawModelPropertyFields(container, asset_json, () =>  { json_data_changed = true });
        }

        if (info.extension == "tileset") {
            asset_preview.classList.remove("add");
            asset_json = await (await fetch(info.url)).json();
            const container = switchPage("#details_tileset_edit");
            AssetsView.drawTilesetPropertyFilelds(container, this.assets, asset_json, () =>  { json_data_changed = true });
            switchPage("#img_asset_preview");

            const texid = (asset_json as any)?.texture;
            if(texid) {
			    const img = querySelector("img") as HTMLImageElement;
			    img.src = this.assets.get(texid).info.url;
            }
        }

        listenFormSubmit({
            form: querySelector("form#asset_props", this.props_container) as HTMLFormElement,
            url: `/assets/upload/${id}`,
            fields: ["name", "extension"],
            files: ["files"],
            custom: {"files": makeJSONFile}
        }, async (s, res) => {
            // should get rid of this loadAsset after each update
            await this.assets.loadAsset(id);
            this.draw(id);
            this.drawDetails(id);
        });
    }

    static drawTilesetPropertyFilelds(container: HTMLElement, assets: Assets, tilesetdata: any, onchange?: () => void) {
        const color_id_prefix = tilesetdata.color_id_prefix;
        const link_id_prefix = tilesetdata.link_id_prefix;
        const durability_id_prefix = tilesetdata.durability_id_prefix;
        
        container.innerHTML = querySelector("template#details_tileset_edit_template").innerHTML;
       
        const properties_container = querySelector("#details_tileset_properties_list", container);
        const aliases_container = querySelector("#details_tileset_aliases_list", container);
        properties_container.innerHTML = aliases_container.innerHTML = "";

        const makePropSelectField = (_container, name, extension = name) => {
            new AssetPropertyEdit().init(tilesetdata, name, onchange).drawSelectOption(async () => {
                const popupel = querySelector("container#popup_content");
                AssetsView.propagate(assets, popupel, {extension: extension}, '');
                const newid = await popupListSelect("select " + extension);
                return newid;
            }, _container);
        };
        const makePropEditField = (_container, name, type = "text") => {
            new AssetPropertyEdit().init(tilesetdata, name, onchange).drawTextEditOption(_container, type);
        }


        const add_splitter = (index: number | string, _container: Element = aliases_container) => {
            const splitter = document.createElement("splitter");
            splitter.innerHTML = "tile " + index;
            _container.appendChild(splitter);
        }

        const getmake_tileenrty = (index: number | string) => {
            const entry_id = "tile_" + index;
            let entry = aliases_container.querySelector("entry#" + entry_id);
            if (!entry) {
                entry = document.createElement("entry");
                entry.id = entry_id;
                aliases_container.appendChild(entry);
                add_splitter(index, entry);
            }

            return entry;
        }

        makePropSelectField(properties_container, "texture", /png/);
        makePropSelectField(properties_container, "default_tile", "model");
        makePropEditField(properties_container, "zero_color");
        makePropEditField(properties_container, "tilesize_x", "number");
        makePropEditField(properties_container, "tilesize_y", "number");


        for (let i = 0; i < tilesetdata.guids; i++) {
            const color_id = color_id_prefix + i;
            const link_id = link_id_prefix + i;
            const durability_id = durability_id_prefix + i;
            const entry = getmake_tileenrty(i);
            makePropEditField(entry, color_id);
            makePropSelectField(entry, link_id, /model|png/);
            makePropEditField(entry, durability_id);
        }
        
        listenClick("#details_tileset_aliases_add", () => {
            const index = tilesetdata.guids++;
            const color_id = color_id_prefix + index;
            const link_id = link_id_prefix + index;
            const durability_id = durability_id_prefix + index;

            tilesetdata[color_id] = "0x000000";
            tilesetdata[link_id] = null;
            tilesetdata[durability_id] = "0x00";

            const entry = getmake_tileenrty(index);
            makePropEditField(entry, color_id);
            makePropSelectField(entry, link_id, /model|png/);
            makePropEditField(entry, durability_id);

            if(onchange) {
                onchange();
            }
        }, undefined, container);
    }

    static drawModelPropertyFields(container: HTMLElement, assets: Assets, modeldata: any, onchange?: () => void) {
        const makePropSelectField = (name, extension = name) => {
            new AssetPropertyEdit().init(modeldata, name, onchange).drawSelectOption(async () => {
                const popupel = querySelector("container#popup_content");
                AssetsView.propagate(assets, popupel, {extension: extension}, '');
                const newid = await popupListSelect("select " + extension);
                return newid;
            }, container);
        };
        const makePropEditField = (name, type = "text") => {
            new AssetPropertyEdit().init(modeldata, name, onchange).drawTextEditOption(container, type);
        }
        const makeCkeckboxField = (name) => {
            new AssetPropertyEdit().init(modeldata, name, onchange).drawCkeckboxOption(container);
        }
        // tynroar torefactor 231226: make unified flow for model and other types
        makePropSelectField("gltf");
        makePropEditField("material")
        makePropSelectField("texture", /png|jpg/);
        makeCkeckboxField("collider");
        makePropEditField("durability");
    }

    _drawModelPropertyFields(container: HTMLElement, modeldata: any, onchange: () => void) {
        AssetsView.drawModelPropertyFields(container, this.assets, modeldata, onchange);
    }

    static draw(assets: Assets, id: string, container: HTMLElement, link: string = "#asset_details") {
        const asset = assets.get(id);
        if (!asset) {
            return;
        }

        const el = (container.querySelector('#' + id) || document.createElement('a')) as HTMLLinkElement;
        el.id = asset.info.id;
        el.dataset["name"] = asset.info.name; 
        if(link) {
            el.href = link;
        }
        container.appendChild(el);
    }

    draw(id: string, container: HTMLElement = this.list_container, link: string = "#asset_details") {
        AssetsView.draw(this.assets, id, container, link);
    }

    static propagate(assets: Assets, container: HTMLElement, filter: any = {}, link: string = "#asset_details") {
        container.innerHTML = "";

        const _assets = assets.find(filter);
        for(const k in _assets) {
            AssetsView.draw(assets, k, container, link);
        }
    }

    propagate(container: HTMLElement = this.list_container, filter: any = {}, link: string = "#asset_details") {
        AssetsView.propagate(this.assets, container, filter, link);
    }

    list_container: HTMLElement;
    props_container: HTMLElement;
    assets: Assets;
    scene_render: SceneRender;
}

export default AssetsView;
export { AssetsView, AssetPropertyEdit };