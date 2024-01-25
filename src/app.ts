import SceneRender from "./render/scene_render";
import Assets from "./assets";
import {SceneEditUtils, SceneEdit } from "./scene_edit";
import SceneEditView from "./views/scene_edit_view";
import { listenFormSubmit, sendFiles } from "./assets";
import { reattach, listenClick, switchPage, querySelector, addEventListener, EventListenerDetails } from "./document";
import { popupListSelectMultiple, popupListSelect } from "./page/popup"
import { importGltfSequence } from "./importer";
import SceneGame from "./scene_game";
import SceneMediator from "./scene_mediator";
import SceneCollisions from "./scene_collisions";
import { lerp } from "./math";
import SceneMap from "./scene_map";
import AppDebug from "./app_debug";
import SceneEditTools from "./render/scene_edit_tools";

import Tabs from "./page/tabs";
import ControlsContainerCollapse from "./page/controls_container_collapse";

import test from "./test/index";

// deprecated {
import AssetsView from "./views/assets_view";
// deprecated }

import { AssetsLibraryView } from "./views";


class App {
    constructor() {
        this.assets = new Assets();
        this.scene_edit = new SceneEdit(this.assets);
        this.scene_collisions = new SceneCollisions();
        this.scene_render = new SceneRender(this.assets);
        this.scene_map = new SceneMap(this.scene_collisions, this.scene_render)
        this.scene_edit_tools = new SceneEditTools(this.scene_render, this.scene_collisions, this.scene_map);
        this.scene_game = new SceneGame(this.scene_collisions, this.scene_render, this.scene_map);
        this.scene_mediator = new SceneMediator(this.scene_edit, this.scene_game, this.scene_map);
        this.assets_view = new AssetsView(this.assets, this.scene_render, this.scene_mediator);
        this.scene_edit_view = new SceneEditView(this.scene_edit, this.scene_render, this.scene_edit_tools, this.scene_mediator, this.scene_map);
        this.assets_library_view = new AssetsLibraryView(this.assets, this.scene_render);

        this.active = false;
        this.timestamp = 0;
        this.fixed_timestep = true;

        this.frame_threshold = 16;
        this.average_frametime = 0;
    }
    init() : App {
        const canvas = document.querySelector("canvas#rootcanvas");
        if (!canvas) {
            throw new Error("can't find canvas to render");
        }

        this.assets.init();
        this.assets_library_view.init();
        this.app_debug_draw = new AppDebug();
        this.app_debug_draw.app_state_draw.init(this);
        this.scene_render.init(canvas as HTMLCanvasElement);
        this.scene_edit_tools.init();
        this.scene_game.init();

        this.initPages();

        return this;
    }

    initPages() {
        const maintabs = new Tabs().init(querySelector("#header"), querySelector("#apptabs"), (id: string) => {
            switch (id) {
                case "play-tab":
                    this.scene_render.reattach(querySelector("#gameroot"))
                    break;
            }
        });
        maintabs.click("library-tab");
        const debugWindows = ControlsContainerCollapse.construct(querySelector("#debug-tab"));
        const test_tabls = new Tabs().init(querySelector("#testcases-select-window"), querySelector("#debug-tab"), (id: string) => {
            switch (id) {
                case "testcase-matters-tab":
                    test.matters(querySelector("#testcase-matters-window content"));
                    break;
                case "testcase-assets-tab":
                    test.assets(querySelector("#testcase-assets-window content"), this.assets);
                    break;
            }
        });
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

        this.average_frametime = this.frame_threshold;
        this.timestamp = performance.now();
        this.loop();

        addEventListener({callback: ()=> {
            querySelector("#rootlayout").classList.add("paused");
            this.active = false;
        }, name: "blur", node: window as any}, this._listeners)
        addEventListener({callback: ()=> {
            querySelector("#rootlayout").classList.remove("paused");
            this.active = true;
            this.timestamp = performance.now();
            this.loop();
        }, name: "focus", node: window as any}, this._listeners)

        this.app_debug_draw.run(this.scene_render.cache);
    }

    private loop() {
        if (!this.active) {
            return;
        }

        const now = performance.now();
        let dtms = (now - this.timestamp);

        if (dtms < this.frame_threshold) {
            requestAnimationFrame( this.loop.bind(this) );
            return;
        }

        if (this.fixed_timestep) {
            dtms = this.frame_threshold;
        }

        const dt = dtms * 0.001;

        this.timestamp = now;
        this.average_frametime = lerp(this.average_frametime, dtms, 0.07);

        this.step(dt);
        this.draw();

        requestAnimationFrame( this.loop.bind(this) );
    }

    step(dt: number) {
        this.scene_game.step(dt);

        // scene_edit_tools steps before scene_render
        this.scene_edit_tools.step(dt);
        this.scene_render.step(dt);

        this.scene_mediator.step();
        this.app_debug_draw.step();
    }

    draw() {
        // scene_edit_tools renders before scene_render
        this.scene_render.render();
        this.scene_edit_tools.render();
    }

    // tmp
    private listenersRun() {
        // tynroar todo: unlisten
        window.addEventListener("hashchange", (event) => {
            this.page(window.location.hash);
        }); 

        listenClick("#scene_edit_tools", async (ev: MouseEvent) => {
            const target = (ev.target as HTMLElement);
            const id = target?.id;
            switch (id) {
                case "play_scene_btn":
                    this.scene_mediator.play();
                    break;
                case "physics_toggle_autostep":
                    this.scene_game.autostep = target.classList.toggle("highlighted");
                    break;
                case "physics_toggle_camera_attach":
                    this.scene_game.attach_camera_to_player = target.classList.toggle("highlighted");
                    break;
                case "physics_toggle_collision_debug":
                    this.scene_render._drawDebug2dAabb = target.classList.toggle("highlighted");
                    break;
                case "game_center_camera":
                    this.scene_render.focusCameraOn(this.scene_render.scene);
                    break;
                case "game_clip_tilesets":
                    const clip = target.classList.toggle("highlighted");
                    this.scene_game._updateTilesetsDraw(clip);
            }
        });

        const res_update_callback = async (success: boolean, res:Response) => {
            const ids = await res.json();
            for(const i in ids) {
                const id = ids[i];
                await this.assets.loadAsset(id);

                // draw in main assets view
                this.assets_view.draw(id);

                // draw in scene list
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
            const file = new File([`{}`], "newscene.scene", {
                type: "application/json",
            });
            sendFiles("/assets/upload", [file], res_update_callback);
        });
        listenClick("#create_tileset_btn", async (ev) => {
            const texture = await popupListSelect("select texture", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: /(png)/}, ''));
            const tileset = SceneEditUtils.contructTilesetData(texture);
            const file = new File([JSON.stringify(tileset)], "newtileset.tileset", {
                type: "application/json",
            });
            sendFiles("/assets/upload", [file], res_update_callback);
        });
        listenClick("#create_model_btn", async (ev) => {
            const modelid: Array<string> = await popupListSelectMultiple("select gltf", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: /gltf/}, ''));
            const modeltexture = await popupListSelect("select texture", (container) => AssetsView.propagate(this.scene_edit.assets, container, {extension: /(png|jpg)/}, ''));
            const files: Array<File> = []
            for (const i in modelid) {
                const modelname = this.assets.get(modelid[i])?.info.name ?? "newmodel";
                // tynroar torefactor 231226: make unified flow for model and other types
                const model = SceneEditUtils.constructModelData(modelid[i], modeltexture);
                const file = new File([JSON.stringify(model)], modelname.split('.').shift() + ".model", {
                    type: "application/json",
                });
                files.push(file);
            }
            sendFiles("/assets/upload", files, res_update_callback);
        });
    }
    async load() {
        this.scene_edit_view.list_container.classList.add("disabled");
        this.assets.events.on("asset", ({id}) => {
            // draw in main assets view
            this.assets_view.draw(id);

            // draw scene list
            if (this.assets.filter(id, {extension: "scene"})) {
                this.assets_view.draw(id, this.scene_edit_view.list_container, "#scene_edit_details");
            }
        })
        await this.assets.load();

        this.scene_edit_view.list_container.classList.remove("disabled");
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


    private assets: Assets;
    private scene_render: SceneRender;
    private scene_edit_tools: SceneEditTools;
    private scene_edit: SceneEdit;
    private scene_edit_view: SceneEditView;
    private scene_mediator: SceneMediator;
    private scene_collisions: SceneCollisions;
    private scene_map: SceneMap;
    private scene_game: SceneGame;
    private assets_library_view: AssetsLibraryView;

    // deprecated {
    private assets_view: AssetsView;
    // deprecated }

    private active: Boolean;
    private timestamp: number;
    private frame_threshold: number;
    private fixed_timestep: boolean;

    private average_frametime: number;

    private _listeners: Array<EventListenerDetails>;

    private app_debug_draw: AppDebug;
}

export default App;
