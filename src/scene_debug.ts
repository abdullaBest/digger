import Character from "./character";
import CharacterPropertyDraw from "./views/character_property_draw";
import { querySelector } from "./document";

export default class SceneDebug {
    private character_properties_draw: CharacterPropertyDraw;

    constructor() {
        this.character_properties_draw = new CharacterPropertyDraw(querySelector("#character_properties_details"));
    }

    run(player_character: Character) {
        this.character_properties_draw.dispose();
        this.character_properties_draw.init(player_character);
    }

    step() {
        this.character_properties_draw.step();
    }
}