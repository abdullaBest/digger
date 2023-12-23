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
        <input id="assets_upload_files" type="file" name="files" accept=".${info.extension}">
        <input type="submit" value="Update"/>
        </form>
        <container id="asset_preview_container">
        <img src='${asset.thumbnail}'></img>
        </container>
        `

        const container = this.props_container.querySelector('#asset_preview_container');
        if (container) {
            if (info.extension == "gltf" || info.extension == "glb") {
                container.classList.add('mode_canvas');
                this.scene.reattach(container as HTMLElement);
                this.scene.viewGLTF(info.url);
            } 
            if (info.extension == "scene") {
                console.log(asset);
            }
        }else {
            console.warn("can't draw preview: #asset_preview_container not found");
        }

        listenFormSubmit({
            form: this.props_container.firstElementChild as HTMLFormElement,
            url: `/assets/upload/${id}`,
            fields: ["name", "extension"],
            files: ["files"]
        }, async (s, res) => {
            await this.assets.loadAsset(id);
            this.draw(id);
            this.drawDetails(id);
        });
    }

    static draw(assets: Assets, id: string, container: HTMLElement, filter: any = {}, link: string = "#asset_details") {
        const asset = assets.get(id, filter);
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
    scene: Scene;
}