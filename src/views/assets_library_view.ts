import Assets from "../assets";
import { querySelector, listenClick } from "../document";
import InspectorMatters from "../page/inspector_matters";

/**
 * Second assets viewer implementation 
 */
export default class AssetsLibraryView {
    assets: Assets;
    container_list: HTMLElement;
    asset_inspector: InspectorMatters;
    asset_info_inspector: InspectorMatters;

    constructor(assets: Assets) {
        this.assets = assets;
    }

    init() {
        this.container_list = querySelector("#assets-library-list content")
        for(const k in this.assets.list) {
            this.listAsset(k);
        }
        this.assets.events.on("asset", ({id}) => {
            this.listAsset(id);
        })

        listenClick(this.container_list, (ev) => {
            const id = (ev.target as HTMLElement)?.id;
            if (this.assets.list[id]) {
                this.viewAsset(id);
            }
        });
    }

    listAsset(id: string) {
        const asset = this.assets.get(id);
        let entry = this.container_list.querySelector("#" + asset.id);
        if (!entry) {
            entry = document.createElement("btn");
            entry.id = asset.id;
            entry.classList.add("flex-row", "gap-minor")

            const thumbnail = document.createElement("img");
            thumbnail.src = asset.thumbnail;
            thumbnail.classList.add('fittext', 'icon');
            const name_label = document.createElement("label");
            const id_label = document.createElement("label");

            name_label.innerHTML = asset.info.name;
            id_label.innerHTML = `[${asset.id}]`;

            entry.appendChild(thumbnail);
            entry.appendChild(id_label);
            entry.appendChild(name_label);
            this.container_list.appendChild(entry);
        }
    }

    viewAsset(id: string) {
        const asset = this.assets.get(id);
        
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
        this.asset_info_inspector = new InspectorMatters(asset.info, this.assets.matters);
        container.appendChild(this.asset_info_inspector.init());
    }
}