import Character from "./character";
import CharacterPropertyDraw from "./views/character_property_draw";
import { querySelector } from "./document";

export default class SceneDebug {
    private character_state_draw: CharacterPropertyDraw;
    private character_config_draw: CharacterPropertyDraw;

    constructor() {
        this.character_state_draw = new CharacterPropertyDraw(querySelector("#character_state_details"));
        this.character_config_draw = new CharacterPropertyDraw(querySelector("#character_config_details"));
    }

    run(player_character: Character) {
        this.character_state_draw.init(player_character).drawState();
        this.character_config_draw.init(player_character).drawConfig();
    }

    stop() {
        this.character_state_draw.dispose();
        this.character_config_draw.dispose();
    }

    step() {
        this.character_state_draw.step();
        this.character_config_draw.step();
    }
}