import Scene from "./scene";
import { listenUploadsForm } from "./assets";

class App {
    constructor() {
        this.scene = new Scene();
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
        listenUploadsForm(document.querySelector("#assets_upload"));

        if (!this.page(window.location.hash)) {
            this.page("#scene_view");
        }
        
        this.scene.run();
        this.active = true;
    }
    stop() {
        this.scene.stop();
        this.active = false;
    }

    /**
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
}

export default App;