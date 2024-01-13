import PropertyDraw from "./property_draw";
import Character from "../character";

export default class CharacterPropertyDraw {
    core: PropertyDraw;
    character: Character;

    constructor(container: HTMLElement) {
        this.core = new PropertyDraw(container);
    }

    init(character: Character) : CharacterPropertyDraw {
        this.character = character;
        this.core.init(character);

        return this;
    }

    drawState() {
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
        this.core.add("sliding_wall");
        this.core.add("running");
        this.core.add("prerunning");
        this.core.add("run_elapsed");
        this.core.add("jump_elapsed");
    }

    drawConfig() {
        this.core.addWrite("movement_speed");
        this.core.addWrite("jump_force");
        this.core.addWrite("jump_threshold");
        this.core.addWrite("wallslide_speed");
        this.core.addWrite("air_control_factor");
        this.core.addWrite("run_vertical_jump_scale");
        this.core.addWrite("run_horisontal_jump_scale");
        this.core.addWrite("run_movement_scale");
        this.core.addWrite("prerun_threshold");
        this.core.addWrite("hook_drag_force");
    }

    dispose() {
        this.core.dispose();
    }

    step() {
        this.core.step();
    }
}