import SceneRender from "./scene_render";
import Assets from "./assets";
import SceneEdit from "./scene_edit";
import SceneEditView from "./views/scene_edit_view";
import AssetsView from "./views/assets_view";
import { listenFormSubmit, sendFiles } from "./assets";
import { reattach, listenClick, popupListSelect, switchPage, querySelector, popupConfirm, popupListSelectMultiple } from "./document";
import { importGltfSequence } from "./importer";
import SceneGame from "./scene_game";

class App {
    constructor() {
        this.assets = new Assets();
        this.scene_edit = new SceneEdit(this.assets);
        this.scene_game = new SceneGame();
        this.scene_render = new SceneRender(this.scene_edit, this.scene_game.colliders);
        this.scene_edit_view = new SceneEditView(this.scene_edit, this.scene_render);
        this.assets_view = new AssetsView(this.assets, this.scene_render);

        this.active = false;
    }
    init() : App {
        const canvas = document.querySelector("canvas#rootcanvas");
        if (!canvas) {
            throw new Error("can't find canvas to render");
        }
        this.scene_render.init(canvas as HTMLCanvasElement);
        return this;
    }
    dispose() {
        this.scene_render.dispose();
        this.stop();
    }
    run() {
        this.assets_view.init(document.querySelector("#assets_list"), document.querySelector("#asset_details_content"))
        this.scene_edit_view.init(document.querySelector("#scene_edit_list"), document.querySelector("#scene_edit_elements"))
        this.load();

        // switch root page
        window.location.hash = "#scene_view"
        this.page("#scene_view");
        
        this.listenersRun();

        this.scene_render.run();
        this.active = true;
        this.loop();
    }

    private loop() {
        if (!this.active) {
            return;
        }

        this.scene_game.step(1);
        this.scene_render.step();

        requestAnimationFrame( this.loop.bind(this) );
    }

    // tmp
    private listenersRun() {
        // tynroar todo: unlisten
        addEventListener("hashchange", (event) => {
            this.page(window.location.hash);
        }); 

        querySelector("#scene_edit_tools").addEventListener("click", async (ev: MouseEvent) => {
            const id = (ev.target as HTMLElement)?.id;
            switch (id) {
                case "play_scene_btn":
                    this.scene_game.run();
                    this.scene_render.removeModel("player_character");
                    const cham = await this.scene_render.addGLTF("res/KayKit_AnimatedCharacter_v1.2.glb", "player_character");
                    break;
            }
        });

        const res_update_callback = async (success: boolean, res:Response) => {
            const ids = await res.json();
            for(const i in ids) {
                const id = ids[i];
                await this.assets.loadAsset(id);
                this.assets_view.draw(id);

                if (this.assets.filter(id, {extension: "scene"})) {
                    this.assets_view.draw(id, this.scene_edit_view.list_container, "#scene_edit_details");
                }
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
            const modelid: Array<string> = await popupListSelectMultiple("select model", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: /gltf/}, ''));
            const modeltexture = await popupListSelect("select texture", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: /(png|jpg)/}, ''));
            const files: Array<File> = []
            for (const i in modelid) {
                const modelname = this.assets.get(modelid[i])?.info.name ?? "newmodel";
                // tynroar torefactor 231226: make unified flow for model and other types
                const model = { gltf: modelid[i], material: "standart", texture: modeltexture };
                const file = new File([JSON.stringify(model)], modelname.split('.').shift() + ".model", {
                    type: "application/json",
                });
                files.push(file);
            }
            sendFiles("/assets/upload", files, res_update_callback);
        });
    }
    async load() {
        await this.assets.load((id)=> {
            this.assets_view.draw(id);

            if (this.assets.filter(id, {extension: "scene"})) {
                this.assets_view.draw(id, this.scene_edit_view.list_container, "#scene_edit_details");
            }
        });
    }
    stop() {
        this.scene_render.stop();
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
		const page = switchPage(id);
        // -- postpage operations. temporal

        // swaps canvas back to scene_render view if it was removed
        if (id.includes('scene_view')) {
            const container = document.querySelector("#scene_view_canvas_container");
            if(container) {
                reattach(querySelector("#scene_edit_tools"), container);
                this.scene_render.reattach(container as HTMLElement);

            } else {
                console.warn("Can't reattach scene_render canvas back to scene_view")
            }
        }
    }

    private active: Boolean;
    private scene_render: SceneRender;
    private scene_edit: SceneEdit;
    private scene_edit_view: SceneEditView;
    private assets: Assets;
    private assets_view: AssetsView;
    private scene_game: SceneGame;
}

export default App;
