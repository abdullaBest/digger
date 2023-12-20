import Scene from "./scene";
import Assets from "./assets";
import AssetsView from "./views/assets_view";
import { listenFormSubmit } from "./assets";

class App {
    constructor() {
        this.scene = new Scene();
        this.assets = new Assets();
        this.assets_view = new AssetsView(this.assets);
        this.active = false;
    }
    init() : App {
        this.scene.init();
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
        listenFormSubmit(document.querySelector("#assets_upload"), "/assets/upload", null, ["files"]);
        this.assets_view.init(document.querySelector("#assets_list"), document.querySelector("#asset_view"))
        this.load();

        // switch root page
        if (!this.page(window.location.hash)) {
            this.page("#scene_view");
        }
        
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
     * 
     * @param id id of page to switch to
     */
    page(id: String) : boolean {
        let pageFound = false;
        const pages = document.body.querySelectorAll("#rootlayout page");
        pages.forEach((v) => {
            if (id.includes(v.id)) {
                v.classList.remove('hidden');
                pageFound = true;
            } else {
                v.classList.add('hidden');

            }
        })

        return pageFound;
    }

    private active: Boolean;
    private scene: Scene;
    private assets: Assets;
    private assets_view: AssetsView;
}

export default App;