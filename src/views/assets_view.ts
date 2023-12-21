import { Assets, listenFormSubmit } from "../assets";
import Scene from "../scene";

export default class AssetsView {
    constructor(assets: Assets, scene: Scene){
        this.assets = assets;
        this.scene = scene;
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

    private drawDetails(id: string) {
        const asset = this.assets.get(id);
        if(!asset) {
            return;
        }
        console.log("Preview asset:", asset);
        const info = asset.info;
        this.props_container.innerHTML = `
        <form id="asset_props">

        <label>Name <input value="${info.name}" type="text" name="name" required/></label>
        <label>Extension <input value="${info.extension}" type="text" name="extension" required disabled/></label>
        <input id="assets_upload_files" type="file" name="file" accept=".${info.extension}">
        <input type="submit" value="Update"/>
        </form>
        <container id="asset_preview_container">
        <img src='${asset.thumbnail}'></img>
        </container>
        `

        if (info.extension == "gltf" || info.extension == "glb") {
            const container = this.props_container.querySelector('#asset_preview_container');
            if (container) {
                container.classList.add('mode_canvas');
                this.scene.reattach(container as HTMLElement);
                this.scene.viewGLTF(info.url);
            } else {
                console.warn("can't draw preview.")
            }
        }

        listenFormSubmit({
            form: this.props_container.firstElementChild as HTMLFormElement,
            url: `/assets/upload/${id}`,
            fields: ["name", "extension"],
            files: ["file"]
        }, async (s, res) => {
            await this.assets.loadAsset(id);
            this.draw(id);
            this.drawDetails(id);
        });
    }

    draw(id: string) {
        const asset = this.assets.list[id];
        if (!asset) {
            return;
        }

        const el = (this.list_container.querySelector('#' + id) || document.createElement('a')) as HTMLElement;
        el.id = asset.info.id;
        el.dataset["name"] = asset.info.name; 
        el.href = "#asset_details"
        this.list_container.appendChild(el);
    }

    propagate() {
        this.list_container.innerHTML = "";

        for(const k in this.assets.list) {
            this.draw(k);
        }
    }

    list_container: HTMLElement;
    props_container: HTMLElement;
    assets: Assets;
    scene: Scene;
}