import AssetsLibraryView from "./assets_library_view";
import { querySelector, listenClick, addEventListener, EventListenerDetails } from "../document";
import { Assets, Asset } from "../assets";

export default class SceneEditView {
    asset_selected: Asset;
    assets_library_view: AssetsLibraryView;
    assets: Assets;
    container_lib: HTMLElement;
    container_list: HTMLElement;
    private _listeners: Array<EventListenerDetails>;

    constructor(assets_library_view: AssetsLibraryView) {
        this.assets_library_view = assets_library_view;
        this.assets = this.assets_library_view.assets;
        this._listeners = [];
    }

    init() {
        const lib_container = querySelector("#edit-assets-section");
        this.container_lib = querySelector("content", lib_container);
        this.container_list = querySelector("#scene-content-list");

        for(const k in this.assets_library_view.assets.list) {
            this.listAssetLib(k);
        }
        this.assets.events.on("asset", ({id}) => {
            this.listAssetLib(id);
        }, this._listeners)

        listenClick(this.container_lib, (ev) => {
            this.saveAsset(this.asset_selected?.id);
            const id = (ev.target as HTMLElement)?.id;
            const matter = this.assets.matters.list[id];
            if (matter && matter.inherited_equals("type", "space")) {
                this.viewAsset(id);
            }
        }, this._listeners)

        const scene_content = this.container_list;
        addEventListener({name: "drop", callback: async (ev) => {
            let id = "";
            const datatransfer = (ev as DragEvent).dataTransfer;
            if (datatransfer) {
                id = datatransfer.getData("text/plain");
            }
            if (this.asset_selected) {
                this.addComponent(this.asset_selected.id, id);
            }
            scene_content.classList.remove("dropallow");
        }, node: scene_content}, this._listeners);
                
        addEventListener({name: "dragenter", callback: async (ev) => {
            scene_content.classList.add("dropallow");
            ev.preventDefault();
        }, node: scene_content}, this._listeners);
        addEventListener({name: "dragover", callback: async (ev) => {
            ev.preventDefault();
        }, node: scene_content}, this._listeners);
        addEventListener({name: "dragleave", callback: async (ev) => {
            scene_content.classList.remove("dropallow");
            ev.preventDefault();
        }, node: scene_content}, this._listeners);
    }

    saveAsset(id: string) {
        this.assets_library_view.saveAsset(id);
    }

    viewAsset(id: string) {
        const header = querySelector("#scene-content-list-header");
        const asset = this.assets.get(id);
        this.asset_selected = asset;
        const matter = this.assets.matters.list[id];
        header.innerHTML = matter.name;

        this.container_list.innerHTML = "";
        for(const k in matter) {

            if (!matter.is_link(k)) {
                continue;
            }

            const val = matter.get(k);
            const _m = this.assets.matters.get(val);
            const entry = this.assets_library_view.listAsset(_m.id, this.container_list);
        }

        this.assets_library_view.renderAsset(id);
    }

    async addComponent(owner: string, inherites: string) {
        const omatter = this.assets.matters.get(owner);

        const inherite = this.assets.matters.get(inherites);
        const extension = inherite.get("type");
        const global_id = await this.assets.uploadComponent({ inherites, owner: owner }, extension);

        const local_id = omatter.get("guilds") ?? 0;
        omatter.set("guids", (local_id) + 1);
        omatter.set_link("e" + local_id, global_id);

        this.viewAsset(owner);
    }

    listAssetLib(id: string) {
        const entry = this.assets_library_view.listAsset(id, this.container_lib);
        const matter = this.assets.matters.list[id];
        if(!matter?.inherited_equals("type", "component")) {
            entry.classList.add("disabled-optional");
        }

        if(matter?.inherited_equals("type", "space") && !entry.querySelector(".img-external")) {
            const icon = document.createElement("icon");
            icon.classList.add("img-external", "fittext");
            entry.insertBefore(icon, entry.firstChild);
        }

        entry.draggable = true;
        addEventListener({name: "dragstart", callback: async (ev) => {
            const datatransfer = (ev as DragEvent).dataTransfer;
            if (datatransfer) {
                datatransfer.setData("text/plain", entry.id);
            }
            //(ev as DragEvent).dataTransfer?.setDragImage(querySelector(".img-thumbnail", entry), 64, 64);
            entry.classList.add("dragged")
        }, node: entry}, this._listeners);
        addEventListener({name: "dragend", callback: async (ev) => {
            entry.classList.remove("dragged")
        }, node: entry}, this._listeners);
    }
}