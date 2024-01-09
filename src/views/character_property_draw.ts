import PropertyDraw from "./property_draw";
import Character from "../character";

export default class CharacterPropertyDraw {
    core: PropertyDraw;
    character: Character;

    constructor(container: HTMLElement) {
        this.core = new PropertyDraw(container);
    }

    init(character: Character) {
        this.character = character;
        this.core.init(character);

        this.core.add("movement_x");
        this.core.add("moving_left");
        this.core.add("moving_right");
        this.core.add("jumping_up");
        this.core.add("jumping_left");
        this.core.add("jumping_right");
        this.core.add("look_direction_x");
        this.core.add("look_direction_y");
        this.core.add("collided_left");
        this.core.add("collided_right");
        this.core.add("collided_top");
        this.core.add("collided_bottom");
    }

    dispose() {
        this.core.dispose();
    }

    step() {
        this.core.step();
    }
}