import { Assets, listenFormSubmit } from "../assets";

export default class AssetsView {
    constructor(assets: Assets){
        this.assets = assets;
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

        this.list_container.addEventListener('click', this.click.bind(this));

        return this;
    }

    private click(event: MouseEvent) {
        const id = (event.target as HTMLElement).id;
        if(!id) {
            return;
        }
        const asset = this.assets.get(id);
        if(!asset) {
            return;
        }
        const info = asset.info;
        this.props_container.innerHTML = `
        <form id="asset_props">

        <label>Name <input value="${info.name}" type="text" name="name" required/></label>
        <label>Extension <input value="${info.extension}" type="text" name="extension" required disabled/></label>
        <input id="assets_upload_files" type="file" name="file" accept=".${info.extension}">
        <input type="submit" />
        </form>
        `
        listenFormSubmit({
            form: this.props_container.firstElementChild as HTMLFormElement,
            url: `/assets/upload/${id}`,
            fields: ["name", "extension"],
            files: ["file"]
        }, async (s, res) => {
            await this.assets.loadAsset(id);
            this.draw(id);
        });
    }

    draw(id: string) {
        const asset = this.assets.list[id];
        if (!asset) {
            return;
        }

        const el = (this.list_container.querySelector('#' + id) || document.createElement('entry')) as HTMLElement;
        el.id = asset.info.id;
        el.dataset["name"] = asset.info.name; 
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
}