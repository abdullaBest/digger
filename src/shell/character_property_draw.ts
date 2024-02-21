import ControlsPropertyDraw from "../document/controls_property_draw";
import Character from "../gameplay/character";

export default class CharacterPropertyDraw {
    core: ControlsPropertyDraw;
    character: Character;

    constructor(container: HTMLElement, toggle_btn?: HTMLElement) {
        this.core = new ControlsPropertyDraw(container, toggle_btn);
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
        this.core.add("airtime_elapsed");
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
        this.core.addWrite("airjump_threshold");
    }

    dispose() {
        this.core.dispose();
    }

    step() {
        this.core.step();
    }
}