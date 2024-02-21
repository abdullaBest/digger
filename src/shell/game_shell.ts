import AppCore from "../app/app_core";
import AppGame from "../app/app_game";
import { querySelector } from "../document";
import { AssetStatus, Assets, AssetContentTypeComponent } from "../app/assets";
import { InputAction } from "../core/game_inputs";

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
	game: AppGame;

	constructor(game: AppGame) {
		this.game = game;
	}

	init() {
		this.healthbar = querySelector("#gamehud #healthbar");
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

		this.game.inputs.events.on("action_start", this._action.bind(this));

		this.game.scene_game.events.on("gameover", () => {
			this.page("gameovermenu");
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
		} else {
			this.page("gamemainmenu");
		}
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
			case InputAction.acion_a:
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
		this.game.scene_game.autostep = true;
		this.page("gamehud");
		const matter = this.core.assets.matters.get(id);
		await this.game.scene_map.add(matter as AssetContentTypeComponent);
		this.game.scene_mediator.play();
		this.game.scene_game.attach_camera_to_player = true;
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
