import AppCore from "./app_core";

import SceneMap from "./scene_map";
import SceneGame from "./scene_game";
import SceneMediator from "./scene_mediator";

export default class AppGame {
	core: AppCore;
	scene_map: SceneMap;
	scene_game: SceneGame;
	scene_mediator: SceneMediator;

	constructor(core: AppCore) {
		this.core = core;

		this.scene_map = new SceneMap(this.core.scene_core);

		this.scene_game = new SceneGame(
			this.core.scene_collisions,
			this.core.scene_render,
			this.scene_map
		);

		this.scene_mediator = new SceneMediator(this.scene_game, this.scene_map);
	}

	init() {
		this.scene_game.init();
		this.scene_map.init();
	}

	step(dt: number) {
		this.scene_game.step(dt);
		this.scene_map.step(dt);
		this.scene_mediator.step();
	}
}
