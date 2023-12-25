import { Assets, listenFormSubmit } from "../assets";
import SceneRender from "../scene";
import { sprintf } from "../lib/sprintf.js";
import { switchPage, querySelector, popupListSelect } from "../document";

/**
 * v1: draws property edit with select option
 */
class AssetPropertyEdit {
    /**
     * @param object object to chenge property in
     * @param key key in object to access
     * @returns this
     */
    init(object: any, key: string, callback?: (value: string) => void) : AssetPropertyEdit {
        this.object = object;
        this.key = key;
        this.callback = callback ?? null;
        
        return this;
    }

    drawSelectOption(onclick: () => Promise<string>, parent?: HTMLElement) : HTMLElement {
        this.element = this.element ?? document.createElement("entry");
        this.element.innerHTML = `<label>${this.key}:(${this.object[this.key]})<btn>set</btn></label>`
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

    drawTextEditOption(parent?: HTMLElement) : HTMLElement {
        this.element = this.element ?? document.createElement("entry");
        this.element.innerHTML = `<label>${this.key}<input value="${this.object[this.key]}", type="text" name="name"></input></label>`
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

    object: any;
    key: string;
    element: HTMLElement | null;
    callback: ((value: string) => void) | null;
}

export default class AssetsView {
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

        // draw previews
        if (info.extension == "gltf" || info.extension == "glb" || info.extension == 'model') {
			const container = switchPage("#canvas_asset_preview");
            this.scene_render.reattach(container as HTMLElement);
            if (info.extension == 'model') {
                this.scene_render.viewModel(id);
            } else {
                this.scene_render.viewGLTF(info.url);
            }
        } else if (info.type.includes("image")) {
			const container = switchPage("#img_asset_preview");
			const img = querySelector("img") as HTMLImageElement;
			img.src = asset.thumbnail;
		} 
        
        let json_data_changed = false;
        let asset_json = null;
        const makeJSONFile = () => {
            if (!json_data_changed) {
                return null;
            }

            const file = new File([JSON.stringify(asset_json)], `v${info.revision}_${info.name}`, {
                type: "application/json",
            });

            return file;
        }
        // draw settings fiels
        if (info.extension == "model") {
			const modeldata = await (await fetch(info.url)).json();
            asset_json = modeldata;
			const container = switchPage("#details_model_edit");
            container.innerHTML = "";

            const makePropSelectField = (name, extension = name) => {
                new AssetPropertyEdit().init(modeldata, name, () => {
                    json_data_changed = true;
                }).drawSelectOption(async () => {
                    const popupel = querySelector("container#popup_content");
                    AssetsView.propagate(this.assets, popupel, {extension: extension}, '');
                    const newid = await popupListSelect("select " + extension);
                    return newid;
                }, container);
            };
            const makePropEditField = (name) => {
                new AssetPropertyEdit().init(modeldata, name, () => {
                    json_data_changed = true;
                }).drawTextEditOption(container);
            }
            makePropSelectField("gltf");
            makePropEditField("material")
            makePropSelectField("texture", "png");
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

    static draw(assets: Assets, id: string, container: HTMLElement, filter: any = {}, link: string = "#asset_details") {
        const asset = assets.get(id);
        if (!asset) {
            return;
        }

        let filtered = false;
        for(const k in filter) {
            if (k in asset.info && asset.info[k] != filter[k]) {
                filtered = true;
                break;
            }
        }
        if (filtered) {
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

    draw(id: string, container: HTMLElement = this.list_container, filter: any = {}, link: string = "#asset_details") {
        AssetsView.draw(this.assets, id, container, filter, link);
    }

    static propagate(assets: Assets, container: HTMLElement, filter: any = {}, link: string = "#asset_details") {
        container.innerHTML = "";

        const _assets = assets.find(filter);
        for(const k in _assets) {
            AssetsView.draw(assets, k, container, filter, link);
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
