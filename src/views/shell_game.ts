import AppCore from "../app_core";
import AppGame from "../app_game";
import { querySelector } from "../document";
import { AssetStatus, Assets } from "../assets";

export default class ShellGame {
	core: AppCore;
	game: AppGame;

	loadingtab: HTMLElement;
	rootcontainer: HTMLElement;

	constructor(core: AppCore, game: AppGame) {
		this.core = core;
		this.game = game;
	}

	init() {
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
	}

	show() {
		if (this.core.assets.status != AssetStatus.LOADED) {
			this.page("gamelodingpage");
		} else {
			this.page("gamemainmenu");
		}
	}

	page(id: string) {
		const pages = this.rootcontainer.querySelectorAll("page");
		for (let i = 0; i < pages.length; i++) {
			const p = pages[i];
			p.classList[p.id === id ? "remove" : "add"]("hidden");
		}
	}
}
