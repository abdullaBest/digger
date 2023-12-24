import SceneRender from "./scene";
import Assets from "./assets";
import SceneEdit from "./scene_edit";
import SceneEditView from "./views/scene_edit_view";
import AssetsView from "./views/assets_view";
import { listenFormSubmit, sendFiles } from "./assets";
import { listenClick, popup } from "./document";

class App {
    constructor() {

        this.assets = new Assets();
        this.assets_view = new AssetsView(this.assets, this.scene);


        this.scene_edit = new SceneEdit(this.assets);
        this.scene = new SceneRender(this.scene_edit);
        this.scene_edit_view = new SceneEditView(this.scene_edit, this.scene);


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
        this.assets_view.init(document.querySelector("#assets_list"), document.querySelector("#asset_details"))
        this.scene_edit_view.init(document.querySelector("#scene_edit_list"), document.querySelector("#scene_edit_elements"))
        this.load();

        // switch root page
        window.location.hash = "#scene_view"
        this.page("#scene_view");
        
        this.listenersRun();

        this.scene.run();
        this.active = true;
    }

    // tmp
    private listenersRun() {
        // tynroar todo: unlisten
        addEventListener("hashchange", (event) => {
            this.page(window.location.hash);
        });

        const res_update_callback = async (success: boolean, res:Response) => {
            const ids = await res.json();
            for(const i in ids) {
                const id = ids[i];
                await this.assets.loadAsset(id);
                this.assets_view.draw(id);
                this.assets_view.draw(id, this.scene_edit_view.list_container, {extension: 'scene'}, "#scene_edit_details");
            }
        }

        listenFormSubmit({
            form: document.querySelector("#assets_upload"), 
            url: "/assets/upload", 
            files: ["files"]
        }, res_update_callback);

        listenClick("#create_scene_btn", (ev) => {
            const file = new File([`{"guids": 0}`], "newscene.scene", {
                type: "application/json",
            });
            sendFiles("/assets/upload", [file], res_update_callback);
        });
        listenClick("#create_model_btn", async (ev) => {
            const popupel = document.querySelector("container#popup_content") as HTMLElement;
            if (!popupel) {
                throw new Error("can't draw popup");
            }
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'gltf'}, '');
            const modelid = await popup("select model");
            const modelname = this.assets.get(modelid)?.info.name ?? "newmodel";
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'bin'}, '');
            const modelbin = await popup("select bin");
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'png'}, '');
            const modeltexture = await popup("select texture");
            const model = {gltf: modelid, bin: modelbin, texture: modeltexture};
            const file = new File([JSON.stringify(model)], modelname + ".model", {
                type: "application/json",
            });
            sendFiles("/assets/upload", [file], res_update_callback);
        });
    }
    async load() {
        await this.assets.load();
        this.assets_view.propagate();
        this.assets_view.propagate(this.scene_edit_view.list_container, {extension: 'scene'}, "#scene_edit_details");
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
    private scene: SceneRender;
    private scene_edit: SceneEdit;
    private scene_edit_view: SceneEditView;
    private assets: Assets;
    private assets_view: AssetsView;
}

export default App;
