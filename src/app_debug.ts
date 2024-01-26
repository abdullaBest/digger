import PropertyDraw from "./views/property_draw";
import { querySelector } from "./document";
import SceneRenderCache from "./render/scene_render_cache";

export default class AppDebug {
    scene_state_draw: PropertyDraw;
    app_state_draw: PropertyDraw;

    constructor() {
        this.app_state_draw = new PropertyDraw(querySelector("#app_state_details"), querySelector("#app_state_details-toggle"));
        this.scene_state_draw = new PropertyDraw(querySelector("#scene_state_details"), querySelector("#scene_state_details-toggle"));
    }

    run(scene_cache: SceneRenderCache) {
        // app_state_draw initialized externally to avoid looped imports
        this.app_state_draw.addWrite("frame_threshold");
        this.app_state_draw.addWrite("fixed_timestep");
        this.app_state_draw.addRead("average_frametime");
        this.app_state_draw.addRead("[fps]", () => 1000 / this.app_state_draw.object.average_frametime);

        this.scene_state_draw.init(scene_cache);
        //this.scene_state_draw.addRead("[cached models]", () => Object.keys(scene_cache.models).length );
        this.scene_state_draw.addRead("[cached objects]", () => Object.keys(scene_cache.objects).length );
        this.scene_state_draw.addRead("[cached gltfs]", () => Object.keys(scene_cache.gltfs).length );
        this.scene_state_draw.addRead("[cached materials]", () => Object.keys(scene_cache.materials).length );
        this.scene_state_draw.addRead("[cached textures]", () => Object.keys(scene_cache.textures).length );
    }

    stop() {
        this.scene_state_draw.dispose();
        this.app_state_draw.dispose();
    }

    step() {
        this.scene_state_draw.step();
        this.app_state_draw.step();
    }
}