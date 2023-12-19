import Scene from "./scene";

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
        addEventListener("hashchange", (event) => {
            this.page(window.location.hash);
        });
        this.page("#scene_view");
        this.scene.run();
        this.active = true;
    }
    stop() {
        this.scene.stop();
        this.active = false;
    }

    page(id: String) {
        const pages = document.body.querySelectorAll("#rootlayout page");
        pages.forEach((v) => {
            id.includes(v.id) ? 
                v.classList.remove('hidden') :
                v.classList.add('hidden');
        })
    }

    private active: Boolean;
    private scene: Scene;
}

export default App;