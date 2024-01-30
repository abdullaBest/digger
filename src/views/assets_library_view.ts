import { Assets, Asset, sendFiles, AssetContentTypeComponent } from "../assets";
import { querySelector, listenClick, EventListenerDetails } from "../document";
import InspectorMatters from "../page/inspector_matters";
import { importGltfSequence, importImageSequence, uploadThumbnail } from "../importer";
import SceneRender from "../render/scene_render";
import SceneMap from "../scene_map";
import { Popup } from "../page/popup";
import ListSelect from "../page/list_select";
import { Matter } from "../matters";
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
            this.saveAsset(this.asset_selected?.id);
            const id = (ev.target as HTMLElement)?.id;
            if (this.assets.list[id]) {
                this.viewAsset(id);
            }
        }, this._listeners)
        
        listenClick("#asset-import-images", async (ev) => {
            await importImageSequence(this.assets);
        }, this._listeners);
        listenClick("#asset-import-gltfs", async (ev) => {
            await importGltfSequence(this.assets);
        }, this._listeners)
        listenClick("#assets-create-component", async (ev) => {
            await this._createComponent("component", null);
        }, this._listeners);
        listenClick("#assets-create-collider", async (ev) => {
            await this._createComponent("collider", null);
        }, this._listeners);
        listenClick("#assets-create-model", async (ev) => {
            const gltfid = await this._showSelectList("select gltf", {extension: /gltf/});
            const textureid = await this._showSelectList("select texture", {extension: /(png|jpg)/});
            await this._createComponent("model", { gltf: "**" + gltfid, texture: "**" + textureid });
        }, this._listeners)
        listenClick("#assets-create-tileset", async (ev) => {
            const textureid = await this._showSelectList("select texture", {extension: /(png)/});
            await this._createComponent("tileset", { texture: "**" + textureid });
        }, this._listeners);
        listenClick("#assets-create-space", async (ev) => {
            await this._createComponent("space");
        }, this._listeners);
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
                const id = await this._createComponent("collider", { owner: this.asset_selected.id });
                link_id = id;
            }
            if (!link_id) {
                return;
            }
            const asset = this.asset_selected;
            asset.content["collider"] = "**" + link_id;
            this.viewAsset(asset.id);
        }, this._listeners);
        listenClick("#asset-tile-add", async (ev) => {
            let link_id = await this._showSelectList("select", {}, "tile", ["create"]);
            if (link_id == "create") {
                const linkid = await this._showSelectList("select component", {}, "component");
                const id = await this._createComponent("tile", { link: "**" + linkid, owner: this.asset_selected.id });
                link_id = id;
            }
            if (!link_id) {
                return;
            }
            const asset = this.asset_selected;
            asset.content["tile_" + link_id] = "**" + link_id;
            this.viewAsset(asset.id);
        }, this._listeners);
        listenClick("#asset-manage-save", async (ev) => {
            if (this.asset_selected) {
                this.saveAsset(this.asset_selected.id);
                await uploadThumbnail(this.asset_selected, this.scene_render);
                this.listAsset(this.asset_selected.id);
            }
        }, this._listeners)
        listenClick("#asset-manage-wipe", async (ev) => {
            await Popup.instance.show().message("Do not use this. Use delete.", "");
            await Popup.instance.show().message("Really?", "Use delete.");
            return this._wipeAsset(this.asset_selected.id);
        }, this._listeners)
        listenClick("#asset-manage-delete", async (ev) => {
            const asset = this.asset_selected;
            const matter = this.assets.matters.get(asset.id)
            this._deleteComponentSequence(matter as AssetContentTypeComponent);
            
        }, this._listeners)
    }

    async saveAsset(id?: string | null) {
        if (!id || !this.assets.list[id]) {
            return;
        }

        const asset = this.assets.get(id);
        if (!asset) {
            return;
        }

        const content = asset.content;
        if (!content) {
            return;
        }

        if (asset.bundle) {
            await this.assets.uploadComponent(content, asset.id, asset.bundle, content.name);
        } else if (asset.info.type.includes("json")) {
            await this.assets.uploadJSON(content, asset.id, { name: content.name });
        } else {
            await this.assets.uploadAsset(asset.id, [], { name: content.name });
        }
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

    async _createComponent(extension: string, content?: any | null) : Promise<string> {
        const inherite_id = await this._showSelectList("inherite", {}, extension);
        const component = { inherites: inherite_id } as Matter;
        if (content) {
            Object.assign(component, content);
        }
        if (inherite_id) {
            const inherite = this.assets.matters.get(inherite_id);
            extension = inherite.get("type") ?? extension;
        }
        return this.assets.uploadComponent(component, extension);
    }

    
    async _createCloneComponent(component: AssetContentTypeComponent) {
        let name = component.name;
        name = name.split(".").shift() || name;
        const _component = Object.assign({}, component);
        (_component as any).id = null;
        const id = await this.assets.uploadComponent(_component, component.type, null, name + "-clone");

        if (!_component.owner) {
            this.viewAsset(id);
        }

        return id;
    }

    async _createInheriteComponent(inherite: AssetContentTypeComponent, content: object = {}) {
        let name = inherite.name;
        name = name.split(".").shift() || name;
        const id = await this.assets.uploadComponent(Object.assign({ inherites: inherite.id }, content), inherite.type, null, name + "-inherite");
        this.viewAsset(id);

        return id;
    }

    async _wipeAsset(id: string) {
        await this.assets.wipeAsset(id);
        const el = this.container_list.querySelector("#" + id) as HTMLElement;
        if (el) {
            el.parentElement?.removeChild(el);
        }
    }

    async _deleteComponentSequence(component: AssetContentTypeComponent) {
        if (component && component.dependents) {
            Popup.instance.show().message("delete error", `Asset ${component.id} has ${component.dependents} dependents. Could not delete`);
            return;
        }

        const links: Array<string> = [];
        for(const k in this.assets.matters.list) {
            const m = this.assets.matters.list[k];
            for(const kk in m) {
                const val = m[kk];
                if (typeof val === "string" && val.startsWith("**") && val.substring(2) === component.id) {
                    links.push(m.id);
                }
            }
        }
        if (links.length) {
            let message = `<q>Asset ${component.id} referensed in [${links}] assets. Could not delete.</q>`;
           
            Popup.instance.show().message("delete error", message);
            return;
        }
        await Popup.instance.show().message("delete?", "");
        return this._wipeAsset(component.id);
    }

    listAsset(id: string, container: HTMLElement = this.container_list) {
        const asset = this.assets.get(id);
        let entry = container.querySelector("#" + asset.id) as HTMLElement;
        let name_label, thumbnail;
        if (!entry) {
            entry = document.createElement("btn");
            entry.id = asset.id;
            entry.classList.add("flex-row", "gap-minor")

            thumbnail = document.createElement("img");
            thumbnail.classList.add('fittext', 'icon', 'img-thumbnail');
            name_label = document.createElement("label");
            name_label.classList.add("label-name", "flex-grow-1");
            const id_label = document.createElement("label");

            id_label.innerHTML = `[${asset.id}:${asset.info.extension}]`;

            entry.appendChild(thumbnail);
            entry.appendChild(name_label);
            entry.appendChild(id_label);
            container.appendChild(entry);
        } else {
            name_label = querySelector(".label-name", entry);
            thumbnail = querySelector(".img-thumbnail", entry);
        }

        name_label.innerHTML = asset.info.name;
        thumbnail.src = asset.thumbnail;

        const matter = this.assets.matters.get(id);
        if (!matter || matter.get("owner")) {
            entry.classList.add("disabled-optional");
        }

        return entry;
    }

    viewAsset(id: string) {
        const matter = this.assets.matters.get(id);
        if (matter) {

            // fix link ids
            id = matter.id;

            // always show asset top tree
            const owner = matter.get("owner")
            if (owner) {
                //this.viewAsset(owner);
                //return;
            }
        }
        
        const asset = this.assets.get(id);
        this.asset_selected = asset;
        if (this.asset_inspector) {
            this.asset_inspector.dispose();
        }

        const container = querySelector("#assets-library-details content")
        container.innerHTML = "";
        try {
            if (asset.content) {
                this._drawAssetInspector(asset, container);
            }

            this.renderAsset(id);
        } catch(err) {
            const errmsg = "AssetsLibraryView::viewAsset error.";
            console.error(errmsg, err);
            container.innerHTML = `<q>${errmsg}</q><q>${err}</q>`
        }
    }

    _drawAssetInspector(asset: Asset, container: HTMLElement) {
        // presetted mutators
        const mutators = {
            texture: this._makePropertySelectBtnCallback(asset.id, "texture", {extension: /(png)/}),
            gltf: this._makePropertySelectBtnCallback(asset.id, "gltf", {extension: /(gltf)/}),
            link: this._makePropertySelectBtnCallback(asset.id, "component", {}, "component"),
        }

        // dynamic mutators - generated for any link
        this.assets.matters.traverse(asset.id, (matter, key, value) => {
            if (typeof value === "string" && value.startsWith("**")) {
                const id = value.substring(2);
                const link = this.assets.matters.get(id) as AssetContentTypeComponent;
                if (link && !mutators[key]) {
                    mutators[key] = this._makePropertySelectBtnCallback(matter.id, link.type, {}, link.type);
                } 
            }
        })

        this.asset_inspector = new InspectorMatters(asset.content, this.assets.matters);
        container.appendChild(this.asset_inspector.init(mutators));
        this.asset_inspector.events?.addEventListener("change", (({detail}) => {
            const id = detail.id;
            const key = detail.key;
            const value_old = detail.value_old;
            const value_new = detail.value_new;
            if (typeof value_old == "string") {
                const ref = this.assets.matters.get(value_old);
                if (ref && ref.get("owner") == id) {
                    this._wipeAsset(ref.id);
                }
            }
            this.viewAsset(asset.id)
        }) as any);
        this.asset_inspector.events?.addEventListener("clone", () => {
            this._createCloneComponent(this.asset_inspector.matter as AssetContentTypeComponent);
        });
        this.asset_inspector.events?.addEventListener("link", () => {
            this._createInheriteComponent(this.asset_inspector.matter as AssetContentTypeComponent);
        });
        this.asset_inspector.events?.addEventListener("delete", () => {
            this._deleteComponentSequence(this.asset_inspector.matter as AssetContentTypeComponent);
        });
        this.asset_inspector.events?.addEventListener("external", (async ({detail}) => {
            this.viewAsset(detail.value);
        }) as any);
        this.asset_inspector.events?.addEventListener("plug", (async ({detail}) => {
            const key = detail.key;
            const value = detail.value;
            const matter = detail.matter;
            const id = await this._createInheriteComponent(this.assets.matters.get(value) as AssetContentTypeComponent, { owner: matter.id });
            matter.set_link(key, id);
        }) as any);
    }

    _makePropertySelectBtnCallback(id: string, name: string, filter: { [id: string] : string | RegExp}, extension?: string) {
        return (value: string, el?: HTMLElement) => {
            const ref = this.assets.matters.get(value);
            if (!el) {
                const btn = document.createElement("btn");
                btn.classList.add("btn-s1", "flex-grow-1", "flex-row", "flex-justify-end");
                listenClick(btn, async (ev) => {
                    ev.stopPropagation();
                    const link_id = await this._showSelectList(`select ${name}`, filter, extension);
                    if (!link_id) {
                        return;
                    }
                    let value = "**" + link_id;
                    btn.dispatchEvent(new CustomEvent("change", { detail : { value }}));
                })
                const img = document.createElement("img");
                img.classList.add("icon", "fittext");
                const label = document.createElement("label");
                btn.appendChild(label);
                btn.appendChild(img);
                el = btn;
            }
            const label = el.querySelector("label");
            if (label) {
                label.innerHTML = `[${value}]`;
            }
            const img = el.querySelector("img");
            if (img && ref) {
                const asset = this.assets.list[ref.id];
                if (asset) {
                    img.src = asset.thumbnail;
                    img.classList.remove("hidden");
                } else {
                    img.classList.add("hidden");
                }
            }

            return el;
        }
    }

    async renderAsset(id: string) {
        this.scene_map.cleanup();
        this.scene_render.clearCached();

        this.container_preview_render.classList.add("hidden");
        this.preview_image.classList.add("hidden");

        const its_component = this.assets.matters.get(id)?.inherited_equals("type", "component");
        querySelector("#asset-components-manage").classList[its_component ? "remove" : "add"]("hidden");

        const asset = this.assets.get(id);
        const matter = this.assets.matters.get(id);

        if (asset.info.extension == "gltf") {
            this.container_preview_render.classList.remove('hidden');

            this.scene_render.viewGLTF(asset.info.url);
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