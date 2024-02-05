import AppCore from "./app_core";
import AppGame from "./app_game";
import AppShell from "./app_shell";

import {
	addEventListener,
	EventListenerDetails,
} from "./document";

import SceneGame from "./scene_game";
import SceneMediator from "./scene_mediator";
import SceneMap from "./scene_map";

class App {
	private core: AppCore;
	private shell: AppShell;
	private game: AppGame;

	constructor() {
		this.core = new AppCore();
		this.game = new AppGame(this.core);
		this.shell = new AppShell(this.core, this.game);

		this.active = false;
		this.timestamp = 0;
		this.fixed_timestep = false;

		this.frame_threshold = 16;
	}

	init(): App {
		this.core.init();
		this.game.init();
		this.shell.init();

		return this;
	}

	step(dt: number) {
		this.core.step(dt);
		this.game.step(dt);
		this.shell.step(dt);
	}

	run() {
		this.core.load();

		this.active = true;

		this.timestamp = performance.now();
		this.loop();

		addEventListener(
			{
				callback: () => {
					this.active = false;
				},
				name: "blur",
				node: window as any,
			},
			this._listeners
		);
		addEventListener(
			{
				callback: () => {
					this.active = true;
					this.timestamp = performance.now();
					this.loop();
				},
				name: "focus",
				node: window as any,
			},
			this._listeners
		);
	}

	stop() {
		this.active = false;
	}

	private loop() {
		if (!this.active) {
			return;
		}

		const now = performance.now();
		let dtms = now - this.timestamp;

		if (dtms < this.frame_threshold) {
			requestAnimationFrame(this.loop.bind(this));
			return;
		}

		if (this.fixed_timestep) {
			dtms = this.frame_threshold;
		}

		const dt = dtms * 0.001;

		this.timestamp = now;

		this.step(dt);

		requestAnimationFrame(this.loop.bind(this));
	}

	private active: Boolean;
	private timestamp: number;
	private frame_threshold: number;
	private fixed_timestep: boolean;

	private _listeners: Array<EventListenerDetails>;
}

export default App;
