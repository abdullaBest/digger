import SceneRender from "./render/scene_render";
import Assets from "./assets";
import { listenClick, querySelector, addEventListener, EventListenerDetails } from "./document";
import SceneGame from "./scene_game";
import SceneMediator from "./scene_mediator";
import SceneCollisions from "./scene_collisions";
import { lerp } from "./math";
import SceneCore from "./scene_core";
import AppDebug from "./app_debug";
import SceneEditTools from "./render/scene_edit_tools";
import SceneMap from "./scene_map";

import Tabs from "./page/tabs";
import ControlsContainerCollapse from "./page/controls_container_collapse";

import test from "./test/index";

import { AssetsLibraryView, SceneEditView } from "./views";


class App {
    constructor() {
        this.assets = new Assets();
        this.scene_collisions = new SceneCollisions();
        this.scene_render = new SceneRender(this.assets);
        this.scene_core = new SceneCore(this.assets.matters, this.scene_collisions, this.scene_render);
        this.scene_map = new SceneMap(this.scene_core);
        this.scene_edit_tools = new SceneEditTools(this.scene_render, this.scene_collisions, this.scene_core);
        this.scene_game = new SceneGame(this.scene_collisions, this.scene_render, this.scene_map);
        this.scene_mediator = new SceneMediator(this.scene_game, this.scene_map);
        this.assets_library_view = new AssetsLibraryView(this.assets, this.scene_render, this.scene_map);
        this.scene_edit_view = new SceneEditView(this.assets_library_view, this.scene_core, this.scene_edit_tools);

        this.active = false;
        this.timestamp = 0;
        this.fixed_timestep = false;

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
        this.scene_edit_view.init();
        this.scene_game.init();
        this.scene_map.init();

        this.initPages();

        return this;
    }

    initPages() {
        const maintabs = new Tabs().init(querySelector("#header"), querySelector("#apptabs"), (id: string) => {
            switch (id) {
                case "play-tab":
                    this.scene_render.reattach(querySelector("#gameroot"))
                    break;
                case "edit-tab":
                    this.scene_render.reattach(querySelector("#edit-section-canvas"))
                    break;
                case "library-tab":
                    this.scene_render.reattach(querySelector("#asset-render-preview"))
                    break;
            }
        });
        maintabs.click("edit-tab");
        const debugWindows = ControlsContainerCollapse.construct(querySelector("#debug-tab"));
        const libraryWindows = ControlsContainerCollapse.construct(querySelector("#library-tab"));
        const editWindows = ControlsContainerCollapse.construct(querySelector("#edit-tab"));
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
        new Tabs().init(querySelector("#docs-sidebar"), querySelector("#docs-section"));
    }

    dispose() {
        this.scene_render.dispose();
        this.stop();
    }
    run() {
        this.load();

        this.listenersRun();

        this.scene_render.run();
        this.active = true;

        this.average_frametime = this.frame_threshold;
        this.timestamp = performance.now();
        this.loop();

        addEventListener({callback: ()=> {
            this.active = false;
        }, name: "blur", node: window as any}, this._listeners)
        addEventListener({callback: ()=> {
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
        this.scene_map.step(dt);

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
            }
        });
    }
    async load() {
        await this.assets.load();
    }
    stop() {
        this.scene_render.stop();
        this.active = false;
    }

    private assets: Assets;
    private scene_render: SceneRender;
    private scene_edit_tools: SceneEditTools;
    private scene_mediator: SceneMediator;
    private scene_collisions: SceneCollisions;
    private scene_core: SceneCore;
    private scene_map: SceneMap;
    private scene_game: SceneGame;
    private assets_library_view: AssetsLibraryView;
    private scene_edit_view: SceneEditView;

    //private scene_edit: SceneEdit;
    //private scene_edit_view: SceneEditView;
    // deprecated {
    //private assets_view: AssetsView;
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
