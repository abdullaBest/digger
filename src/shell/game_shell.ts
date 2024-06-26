import AppCore from "../app/app_core";
import AppGame from "../app/app_game";
import { querySelector } from "../document";
import { AssetStatus, Assets, AssetContentTypeComponent } from "../app/assets";
import { InputAction } from "../core/game_inputs";
import { CharacterToolModes } from "../gameplay/character";

class MenuControls {
	container: HTMLElement;
	buttons: Array<HTMLElement>;
	selected: number;
	selected_el: HTMLElement;

	init(container: HTMLElement) {
		this.buttons = [];
		this.selected = 0;
		this.container = container;
		const btns = this.container.querySelectorAll("btn");
		for (let i = 0; i < btns.length; i++) {
			const btn = btns[i] as HTMLElement;
			if (!btn.dataset["label"]) {
				btn.dataset["label"] = btn.dataset["action"];
			}
			this.buttons.push(btn);
		}

		this.select(0);
	}

	select(index: number) {
		for (const i in this.buttons) {
			this.buttons[i].classList.remove("selected");
		}

		if (index < 0) {
			index = this.buttons.length - 1;
		}
		index = index % this.buttons.length;
		this.selected = index;
		const btn = this.buttons[index];
		if (btn) {
			btn.classList.add("selected");
		}
		this.selected_el = btn;
	}

	/**
	 * @brief returns data-action of currently selected element
	 */
	get_selected(): string | null {
		return this.selected_el?.dataset["action"] ?? null;
	}

	next() {
		this.select(this.selected + 1);
	}

	prev() {
		this.select(this.selected - 1);
	}
}

class GameHud {
	healthbar: HTMLElement;
	torchbar: HTMLElement;
	toolmode: HTMLElement;
	game: AppGame;
	controlshelp: HTMLElement;

	constructor(game: AppGame) {
		this.game = game;
	}

	init() {
		this.healthbar = querySelector("#gamehud #healthbar");
		this.torchbar = querySelector("#gamehud #torchbar");
		this.toolmode = querySelector("#gamehud #toolmode");
		this.controlshelp = querySelector("#controlshelp");
	}

	step(dt: number) {
		const character = this.game.scene_game.player_character;
		if (!character) {
			return;
		}
		this.healthbar.style.setProperty(
			"--progress",
			character.health * 100 + "%"
		);

		this.torchbar.style.setProperty(
			"--progress",
			character.gadget_torch.amount * 100 + "%"
		);

		this.toolmode.innerHTML = CharacterToolModes[character.tool_mode]
	}

	_highlight_help_controls(act: InputAction, start: boolean) {
		const el = this.controlshelp.querySelector("." + InputAction[act]);
		el?.classList[start ? "add" : "remove"]("highlighted");
	}

}

export default class GameShell {
	core: AppCore;
	game: AppGame;
	gamehud: GameHud;

	loadingtab: HTMLElement;
	rootcontainer: HTMLElement;

	menucontrols: MenuControls;
	menus_history: Array<string>;
	menu_page: string;
	active: boolean;

	constructor(core: AppCore, game: AppGame) {
		this.core = core;
		this.game = game;
		this.gamehud = new GameHud(game);
	}

	init() {
		this.gamehud.init();
		this.menucontrols = new MenuControls();
		this.rootcontainer = querySelector("#gameui");
		this.loadingtab = querySelector("#gameloadingpage", this.rootcontainer);

		const progressbar = querySelector("#gameloadingbar", this.loadingtab);
		this.core.assets.events.on("asset", () => {
			const progress = this.core.assets.loadprogress * 100;
			progressbar.style.setProperty("--progress", progress + "%");
		});
		this.core.assets.events.on("loaded", () => {
			this.show();
		});

		this.game.inputs.events.on("action_start", (act: InputAction) => {
			this._action(act);
			this.gamehud._highlight_help_controls(act, true);
		});
		this.game.inputs.events.on("action_end", (act: InputAction) => {
			this.gamehud._highlight_help_controls(act, false);
		});

		this.game.scene_game.events.on("gameover", () => {
			this.page("gameovermenu");
		});

		this.game.scene_mediator.events.on("scene_close", ()=> {
			this.overlay("showin");
		});
		this.game.scene_mediator.events.on("scene_open", ()=> {
			this.overlay("showout");
		});
	}

	step(dt: number) {
		if (!this.active) {
			return;
		}
		this.gamehud.step(dt);
	}

	show() {
		this.active = true;
		this.game.scene_map.cleanup();
		this.core.scene_render.clearCached();

		this.menus_history = [];
		if (this.core.assets.status != AssetStatus.LOADED) {
			this.page("gameloadingpage");
			this.overlay("hidden");
		} else {
			this.page("gamemainmenu");
			//this.overlay("showinout");
		}
	}

	/*
	 * @param style {string} showin, showout, showinout, hidden
	 */
	overlay(style: string) {
		const overlay = querySelector("#loading-overlay");

		/* trigger reflow */
		overlay.style.animation = 'none';
		overlay.offsetHeight; 
		overlay.style.animation = null; 

		overlay.classList.remove("showin", "showout", "showinout", "hidden");
		overlay.classList.add(style);
	}

	hide() {
		this.active = false;
	}

	_action(act: InputAction) {
		if (!this.active) {
			return;
		}

		switch (act) {
			case InputAction.up:
				this.menucontrols.prev();
				break;
			case InputAction.down:
				this.menucontrols.next();
				break;
			case InputAction.action_a:
				this._menu_action(this.menucontrols.get_selected());
				break;
			case InputAction.action_esc:
				this._esc_action();
				break;
		}
	}

	_esc_action() {
		const page = this.get_page();
		switch (page) {
			case "gamehud":
				this.page("gamepausemenu");
				this.game.scene_game.autostep = false;
				break;
			case "gamepausemenu":
				this.page_prev();
				this.game.scene_game.autostep = true;
				break;
			default:
				if (page !== "gamemainmenu") {
					this.page_prev();
				}
				break;
		}
	}

	_menu_action(act: string) {
		switch (act) {
			case "play":
				this._propagate_levelselect_options();
				this.page("gamelevelselectmenu");
				break;
			case "levelselect":
				this._play_level(this.menucontrols.selected_el.dataset["id"]);
				break;
			case "credits":
				this.page("gamecreditsmenu");
				break;
			case "back":
				this.page_prev();
				break;
			case "continue":
				this.page_prev();
				this.game.scene_game.autostep = true;
				break;
			case "exit":
				this.show();
				break;
		}
	}

	async _play_level(id: string) {
		this.game.scene_mediator.sceneClose();
		this.game.scene_game.autostep = true;
		this.page("gamehud");
		this.game.scene_mediator.sceneOpen(id);
		this.game.scene_game.attach_camera_to_player = true;
		//this.core.scene_render.global_lights.visible = false;
		this.game.scene_map.debugColliders(false);
	}

	_propagate_levelselect_options() {
		const container = querySelector("#levelselectoptions");
		container.innerHTML = "";

		for (const k in this.core.assets.list) {
			const asset = this.core.assets.list[k];

			if (asset.content?.type !== "space") {
				continue;
			}

			const btn = document.createElement("btn");
			btn.dataset["label"] = asset.content.name;
			btn.dataset["action"] = "levelselect";
			btn.dataset["id"] = asset.id;
			container.appendChild(btn);
		}
	}

	get_page() {
		return this.menus_history[this.menus_history.length - 1];
	}

	page_prev() {
		this.menus_history.pop();
		this.page(this.menus_history.pop());
	}

	page(id: string) {
		if (this.get_page() === id) {
			return;
		}

		this.menu_page = id;

		this.menus_history.push(id);

		const pages = this.rootcontainer.querySelectorAll("page");
		let page = null;
		for (let i = 0; i < pages.length; i++) {
			const p = pages[i] as HTMLElement;
			p.classList.add("hidden");

			if (p.id === id) {
				p.classList.remove("hidden");
				this.menucontrols.init(p);
			}
		}
	}
}
