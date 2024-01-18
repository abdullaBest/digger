import Character from "./character";
import CharacterPropertyDraw from "./views/character_property_draw";
import PropertyDraw from "./views/property_draw";
import { querySelector } from "./document";
import SceneRenderCache from "./render/scene_render_cache";

export default class SceneDebug {
    private character_state_draw: CharacterPropertyDraw;
    private character_config_draw: CharacterPropertyDraw;
    camera_config_draw: PropertyDraw;

    constructor() {
        this.character_state_draw = new CharacterPropertyDraw(querySelector("#character_state_details"), querySelector("#character_state_details-toggle"));
        this.character_config_draw = new CharacterPropertyDraw(querySelector("#character_config_details"), querySelector("#character_config_details-toggle"));
        this.camera_config_draw = new PropertyDraw(querySelector("#game_config_details"), querySelector("#game_config_details-toggle"));
    }

    run(player_character: Character, camera_config: { attach_camera_z: number, attach_camera_y: number }) {
        this.character_state_draw.init(player_character).drawState();
        this.character_config_draw.init(player_character).drawConfig();

        this.camera_config_draw.init(camera_config);
        this.camera_config_draw.addWrite("attach_camera_z");
        this.camera_config_draw.addWrite("attach_camera_y");
    }

    stop() {
        this.character_state_draw.dispose();
        this.character_config_draw.dispose();
        this.camera_config_draw.dispose();
    }

    step() {
        this.character_state_draw.step();
        this.character_config_draw.step();
        this.camera_config_draw.step();
    }
}