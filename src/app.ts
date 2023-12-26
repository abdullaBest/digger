import SceneRender from "./scene";
import Assets from "./assets";
import SceneEdit from "./scene_edit";
import SceneEditView from "./views/scene_edit_view";
import AssetsView from "./views/assets_view";
import { listenFormSubmit, sendFiles } from "./assets";
import { listenClick, popupListSelect, switchPage, querySelector, popupConfirm } from "./document";
import { importGltfSequence } from "./importer";

class App {
    constructor() {

        this.assets = new Assets();
        this.scene_edit = new SceneEdit(this.assets);
        this.scene = new SceneRender(this.scene_edit);
        this.scene_edit_view = new SceneEditView(this.scene_edit, this.scene);
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

        listenClick("#upload_gltf_btn", async () =>  {
            const res = await importGltfSequence();
            res_update_callback(res.ok, res);
        });


        listenClick("#create_scene_btn", (ev) => {
            const file = new File([`{"guids": 0}`], "newscene.scene", {
                type: "application/json",
            });
            sendFiles("/assets/upload", [file], res_update_callback);
        });
        listenClick("#create_model_btn", async (ev) => {
            const modelid = await popupListSelect("select model", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: 'gltf'}, ''));
            const modelname = this.assets.get(modelid)?.info.name ?? "newmodel";
            const modeltexture = await popupListSelect("select texture", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: 'png'}, ''));

            // tynroar torefactor 231226: make unified flow for model and other types
            const model = { gltf: modelid, material: "standart", texture: modeltexture, pos_x: 0, pos_y: 0, pos_z: 0 };
            const file = new File([JSON.stringify(model)], modelname.split('.').shift() + ".model", {
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
		switchPage(id);
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
