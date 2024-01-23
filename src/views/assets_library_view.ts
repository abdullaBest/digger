import Assets from "../assets";
import { querySelector } from "../document";

export default class AssetsLibraryView {
    assets: Assets;
    container_list: HTMLElement;

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
}