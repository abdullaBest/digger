import AppCore from "./app_core";

import SceneMap from "./scene_map";
import SceneDiggerGame from "../gameplay/scene_digger_game";
import SceneMediator from "./scene_mediator";
import GameInputs from "../core/game_inputs";

export default class AppGame {
	core: AppCore;
	inputs: GameInputs;
	scene_map: SceneMap;
	scene_game: SceneDiggerGame;
	scene_mediator: SceneMediator;

	constructor(core: AppCore) {
		this.core = core;
		this.inputs = new GameInputs();

		this.scene_map = new SceneMap(this.core.scene_core);

		this.scene_game = new SceneDiggerGame(
			this.core.scene_collisions,
			this.core.scene_render,
			this.scene_map,
			this.inputs
		);

		this.scene_mediator = new SceneMediator(this.scene_game, this.scene_map);
	}

	init() {
		this.scene_game.init();
		this.scene_map.init();
		this.inputs.init();
	}

	step(dt: number) {
		this.scene_game.step(dt);
		this.scene_map.step(dt);
		this.scene_mediator.step();
	}
}
