import { Assets, Asset, sendFiles, AssetContentTypeComponent } from "../assets";
import { querySelector, listenClick, EventListenerDetails } from "../document";
import InspectorMatters from "../page/inspector_matters";
import { importGltfSequence, importImageSequence, uploadThumbnail } from "../importer";
import SceneRender from "../render/scene_render";
import SceneMap from "../scene_map";
import { Popup } from "../page/popup";
import ListSelect from "../page/list_select";
/**
 * Second assets viewer implementation 
 */
export default class AssetsLibraryView {
    asset_selected: Asset;
    assets: Assets;
    container_list: HTMLElement;
    container_preview_render: HTMLElement;
    preview_image: HTMLImageElement;
    asset_inspector: InspectorMatters;
    asset_info_inspector: InspectorMatters;
    scene_render: SceneRender;
    scene_map: SceneMap;
    private _listeners: Array<EventListenerDetails>;

    constructor(assets: Assets, scene_render: SceneRender, scene_map: SceneMap) {
        this.assets = assets;
        this._listeners = [];
        this.scene_render = scene_render;
        this.scene_map = scene_map;
    }

    init() {
        this.container_list = querySelector("#assets-library-list content");
        this.container_preview_render = querySelector("#assets-library-preview #asset-render-preview");
        this.preview_image = querySelector("#assets-library-preview #asset-image-preview") as HTMLImageElement;
        for(const k in this.assets.list) {
            this.listAsset(k);
        }
        this.assets.events.on("asset", ({id}) => {
            this.listAsset(id);
        }, this._listeners)

        listenClick(this.container_list, (ev) => {
            const id = (ev.target as HTMLElement)?.id;
            if (this.assets.list[id]) {
                this.viewAsset(id);
            }
        }, this._listeners)
        
        const res_update_callback = async (success: boolean, res:Response): Promise<Array<string>> => {
            const ids = await res.json();
            for(const i in ids) {
                const id = ids[i];
                await this.assets.loadAsset(id);
            }

            return ids;
        }

        listenClick("#asset-import-images", async (ev) => {
            const res = await importImageSequence();
            res_update_callback(res.ok, res);
        }, this._listeners);
        listenClick("#asset-import-gltfs", async (ev) => {
            const res = await importGltfSequence();
            res_update_callback(res.ok, res);
        }, this._listeners)
        listenClick("#assets-create-component", async (ev) => {
            await this._createComponent("component", null, res_update_callback);
        }, this._listeners);
        listenClick("#assets-create-model", async (ev) => {
            const gltfid = await this._showSelectList("select gltf", {extension: /gltf/});
            const textureid = await this._showSelectList("select texture", {extension: /(png|jpg)/});
            await this._createComponent("model", { gltf: gltfid, texture: textureid }, res_update_callback);
        }, this._listeners)
        listenClick("#asset-component-add", async (ev) => {
            const link_id = await this._showSelectList("select", {}, "component");
            if (!link_id) {
                return;
            }
            const extension = this.assets.get(link_id).info.extension;
            const asset = this.asset_selected;
            asset.content[extension] = "**" + link_id;
            this.viewAsset(asset.id);
        }, this._listeners)
        listenClick("#asset-collider-add", async (ev) => {
            let link_id = await this._showSelectList("select", {}, "collider", ["create"]);
            if (link_id == "create") {
                const res = await this._createComponent("collider", null);
                const ids = await res_update_callback(res.ok, res);
                link_id = ids[0];
            }
            const asset = this.asset_selected;
            asset.content["collider"] = "**" + link_id;
            this.viewAsset(asset.id);
        }, this._listeners);
        listenClick("#asset-manage-save", async (ev) => {
            const asset = this.asset_selected;
            if (!asset) {
                return;
            }
            const content = asset.content;
            if (!content) {
                return;
            }
            const file = new File([JSON.stringify(content)], `v${asset.info.revision}_${asset.info.name}`, {
                type: "application/json",
            });

            const formData = new FormData();
            formData.append("name", content.name);
            formData.append("files", file);

            const res = await fetch(`/assets/upload/${asset.id}`, {
                method: 'POST',
                body: formData,
                headers: {}
            })
            await this.assets.loadAsset(asset.id);
            }, this._listeners)
    }

    async _showSelectList(message: string, filter: any = {}, extension?: string, extra?: Array<string>): Promise<string | null> {
        const select = new ListSelect();
        await Popup.instance.show().confirm(message, (container) => {
            const filtered = this.assets.find(filter);
            for(const k in filtered) {
                if (extension && !this.assets.matters.list[k]?.inherited_equals("type", extension)) {
                    continue;
                }

                const btn = this.listAsset(k, container);
                btn.classList.add("option");
            }

            if (extra && extra.length) {
                for(const i in extra) {
                    const btn = document.createElement("btn");
                    btn.id = extra[i];
                    btn.innerHTML = btn.id;
                    btn.classList.add("option");
                    container.appendChild(btn);
                }
            }
           
            select.init(container);
        });

        const selected = select.selected();
        select.dispose();
        return selected.shift() ?? null;
    }

    async _createComponent(extension: string, content?: any | null, callback?: (success: boolean, res:Response) => void) {
        const inherites = await this._showSelectList("inherite", {}, extension);
        const component = { inherites };
        if (content) {
            Object.assign(component, content);
        }
        const file = new File([JSON.stringify(component)], `new.${extension}`, {
            type: "application/json",
        });
        return sendFiles("/assets/upload", [file], callback);
    }

    listAsset(id: string, container: HTMLElement = this.container_list) {
        const asset = this.assets.get(id);
        let entry = container.querySelector("#" + asset.id) as HTMLElement;
        let name_label;
        if (!entry) {
            entry = document.createElement("btn");
            entry.id = asset.id;
            entry.classList.add("flex-row", "gap-minor")

            const thumbnail = document.createElement("img");
            thumbnail.src = asset.thumbnail;
            thumbnail.classList.add('fittext', 'icon');
            name_label = document.createElement("label");
            name_label.classList.add("label-name");
            const id_label = document.createElement("label");

            id_label.innerHTML = `[${asset.id}:${asset.info.extension}]`;

            entry.appendChild(thumbnail);
            entry.appendChild(id_label);
            entry.appendChild(name_label);
            container.appendChild(entry);
        } else {
            name_label = querySelector(".label-name", entry);
        }

        name_label.innerHTML = asset.info.name;

        return entry;
    }

    viewAsset(id: string) {
        const asset = this.assets.get(id);
        this.asset_selected = asset;
        
        if (this.asset_inspector) {
            this.asset_inspector.dispose();
        }
        if (this.asset_info_inspector) {
            this.asset_info_inspector.dispose();
        }

        const container = querySelector("#assets-library-details content")
        container.innerHTML = "";
        if (asset.content) {
            this.asset_inspector = new InspectorMatters(asset.content, this.assets.matters);
            container.appendChild(this.asset_inspector.init());
        }

        this.renderAsset(id);
    }

    async renderAsset(id: string) {
        this.scene_map.cleanup();
        this.scene_render.clearCached();
        this.scene_render.reattach(this.container_preview_render as HTMLElement);

        this.container_preview_render.classList.add("hidden");
        this.preview_image.classList.add("hidden");

        const its_component = this.assets.matters.get(id)?.inherited_equals("type", "component");
        querySelector("#asset-components-manage").classList[its_component ? "remove" : "add"]("hidden");

        const asset = this.assets.get(id);
        const matter = this.assets.matters.get(id);

        if (asset.info.extension == "gltf") {
            this.container_preview_render.classList.remove('hidden');

            this.scene_render.viewGLTF(asset.info.url).then(() => {
                if (!asset.thumbnail) {
                    uploadThumbnail(asset, this.scene_render);
                }
            });
        } else if (asset.info.type.includes("image")) {
            this.preview_image.classList.remove('hidden');
			this.preview_image.src = asset.thumbnail;
		} else if (matter.inherited_equals("type", "component")) {
            this.container_preview_render.classList.remove('hidden');
            await this.scene_map.add(matter as AssetContentTypeComponent);
            const obj = this.scene_render.cache.objects[matter.id];
            if (obj) {
                this.scene_render.focusCameraOn(obj);
            }
        }
    }
}