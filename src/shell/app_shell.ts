import AppCore from "../app/app_core";
import AppGame from "../app/app_game";
import { InputAction } from "../core/game_inputs";
import { logger, LogCode } from "../core/logger";

import AssetsLibraryView from "./assets_library_view";
import SceneEditTools from "./scene_edit_tools";
import SceneEditView from "./scene_edit_view";

import GameShell from "./game_shell";

import ControlsTabs from "../document/controls_tabs";
import ControlsContainerCollapse from "../document/controls_container_collapse";
import { listenClick, querySelector } from "../document";
import test from "../test/index";
import infobox from "./infobox";
import AppTerminal from "./app_terminal";

/**
 * holds view classes
 */
export default class AppShell {
	core: AppCore;
	game: AppGame;

	assets_library_view: AssetsLibraryView;
	scene_edit_tools: SceneEditTools;
	scene_edit_view: SceneEditView;

	shell_game: GameShell;
	terminal: AppTerminal;

	constructor(core: AppCore, game: AppGame) {
		this.core = core;
		this.game = game;

		this.assets_library_view = new AssetsLibraryView(
			this.core.assets,
			this.core.scene_render,
			this.core.scene_map
		);

		this.scene_edit_tools = new SceneEditTools(
			this.core.scene_render,
			this.core.scene_collisions,
			this.core.scene_map,
			this.core.assets
		);

		this.scene_edit_view = new SceneEditView(
			this.assets_library_view,
			this.core.scene_core,
			this.scene_edit_tools
		);

		this.shell_game = new GameShell(this.core, this.game);

		this.terminal = new AppTerminal();
		this.game.inputs.events.on("action_start", this._action.bind(this));
	}

	init() {
		this.terminal.init(querySelector("#terminal"));

		infobox.init(querySelector("#infobox"));
		logger.init((code: LogCode, level: number, ...args) => {
			this.terminal.print(code, args.join(", "));
		});

		logger.log("Terminal log initialized.");

		this.assets_library_view.init();
		this.scene_edit_tools.init();
		this.scene_edit_view.init();

		this.shell_game.init();

		this.initPages();
		this.initListeners();

		logger.log("App shell initialized.");
	}

	step(dt: number) {
		this.scene_edit_tools.step(dt);
		this.scene_edit_tools.render();
		this.shell_game.step(dt);
	}

	_action(act: InputAction) {
		switch (act) {
			case InputAction.action_cmd:
				this.terminal.toggle();
				break;
			case InputAction.action_enter:
				this.terminal.confirm();
				break;
		}
	}

	initPages() {
		const maintabs = new ControlsTabs(
			querySelector("#header"),
			querySelector("#apptabs")
		).init((id: string) => {
			this.shell_game.hide();

			switch (id) {
				case "play-tab":
					this.core.scene_render.reattach(querySelector("#gameroot"));
					this.shell_game.show();
					break;
				case "edit-tab":
					this.core.scene_render.reattach(
						querySelector("#edit-section-canvas")
					);
					break;
				case "library-tab":
					this.core.scene_render.reattach(
						querySelector("#asset-render-preview")
					);
					break;
			}
		});
		maintabs.click("play-tab");

		const debugWindows = ControlsContainerCollapse.construct(
			querySelector("#debug-tab")
		);

		const libraryWindows = ControlsContainerCollapse.construct(
			querySelector("#library-tab")
		);

		const editWindows = ControlsContainerCollapse.construct(
			querySelector("#edit-tab")
		);

		const test_tabls = new ControlsTabs(
			querySelector("#testcases-select-window"),
			querySelector("#debug-tab")
		).init((id: string) => {
			switch (id) {
				case "testcase-matters-tab":
					test.matters(querySelector("#testcase-matters-window content"));
					break;
				case "testcase-assets-tab":
					test.assets(
						querySelector("#testcase-assets-window content"),
						this.core.assets
					);
					break;
				case "testcase-animator-tab":
					test.animator(querySelector("#testcase-animator-window content"));
					break;
			}
		});

		new ControlsTabs(
			querySelector("#docs-sidebar"),
			querySelector("#docs-section")
		).init();
	}

	private initListeners() {
		listenClick("#scene_edit_tools", async (ev: MouseEvent) => {
			const target = ev.target as HTMLElement;
			const id = target?.id;
			switch (id) {
				case "play_scene_btn":
					this.game.scene_mediator.play();
					break;
				case "physics_toggle_autostep":
					this.game.scene_game.autostep =
						target.classList.toggle("highlighted");
					break;
				case "physics_toggle_camera_attach":
					this.game.scene_game.attach_camera_to_player =
						target.classList.toggle("highlighted");
					break;
				case "physics_toggle_collision_debug":
					this.game.scene_map.debugColliders(
						target.classList.toggle("highlighted")
					);
					break;
				case "game_center_camera":
					this.core.scene_render.focusCameraOn(this.core.scene_render.scene);
					break;
				case "game_clip_tilesets":
					const clip = target.classList.toggle("highlighted");
					this.game.scene_map.clipTilesDraw(clip);
					break;
				case "scene_toggle_lights":
					const light = target.classList.toggle("highlighted");
					this.core.scene_render.global_lights.visible = light;
			}
		});
	}
}
