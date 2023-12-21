import Scene from "./scene";
import Assets from "./assets";
import AssetsView from "./views/assets_view";
import { listenFormSubmit } from "./assets";

class App {
    constructor() {
        this.scene = new Scene();
        this.assets = new Assets();
        this.assets_view = new AssetsView(this.assets, this.scene);
        this.active = false;
    }
    init() : App {
        const canvas = document.querySelector("canvas#rootcanvas");
        if (!canvas) {
            throw new Error("can't find canvas to render");
        }
        this.scene.init(canvas as HTMLCanvasElement);
        return this;
    }
    dispose() {
        this.scene.dispose();
        this.stop();
    }
    run() {
        // tynroar todo: unlisten
        addEventListener("hashchange", (event) => {
            this.page(window.location.hash);
        });
        listenFormSubmit({
            form: document.querySelector("#assets_upload"), 
            url: "/assets/upload", 
            files: ["files"]
        }, async (s, res) => {
            const ids = await res.json();
            for(const i in ids) {
                const id = ids[i];
                await this.assets.loadAsset(id);
                this.assets_view.draw(id);
            }
        });
        this.assets_view.init(document.querySelector("#assets_list"), document.querySelector("#asset_details"))
        this.load();

        // switch root page
        window.location.hash = "#assets_view"
        this.page("#assets_view");
        
        this.scene.run();
        this.active = true;
    }
    async load() {
        await this.assets.load();
        this.assets_view.propagate();
    }
    stop() {
        this.scene.stop();
        this.active = false;
    }

    /**
     * tynroar todo: move into page control logic
     * Using this function as global page switcher for all layouts
     * To avoid listening callbacks on all bottons
     * 
     * @param id id of page to switch to
     */
    page(id: string) {
        // find requested element
        const el = document.querySelector(id);
        if(!el) { throw new Error("page: no such element " + id); }
        if (!el.parentElement) { throw new Error(`page: element #${id} has no parent`); }

        const pages = document.querySelectorAll(`#${el.parentElement.id} > page`);
        console.log(pages)
        pages.forEach((v) => {
            if (id.includes(v.id)) {
                v.classList.remove('hidden');
            } else {
                v.classList.add('hidden');
            }
        })

        // -- postpage operations. temporal

        // swaps canvas back to scene view if it was removed
        if (id.includes('scene_view')) {
            const container = document.querySelector("#scene_view_canvas_container");
            if(container) {
                this.scene.reattach(container as HTMLElement);
            } else {
                console.warn("Can't reattach scene canvas back to scene_view")
            }
        }
    }

    private active: Boolean;
    private scene: Scene;
    private assets: Assets;
    private assets_view: AssetsView;
}

export default App;