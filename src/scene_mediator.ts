import SceneEdit from "./scene_edit";
import SceneRender from "./scene_render";
import SceneGame from "./scene_game";

class SceneMediator {
    scene_edit: SceneEdit;
    scene_render: SceneRender;
    scene_game: SceneGame;

    active_scene: string | null;

    constructor(scene_edit, scene_render, scene_game) {
        this.scene_edit = scene_edit;
        this.scene_game = scene_game;
        this.scene_render = scene_render;
        this.active_scene = null;
    }

    async sceneOpen(id: string) {
        if(this.active_scene) {
            throw new Error("SceneMediator::sceneOpen. Can't open new scene before active one closed.");
        }

        this.active_scene = id;
        await this.scene_edit.load(id);
    }

    sceneClose() {
        this.active_scene = null;
        this.scene_render.clearModels();
        this.scene_render.clearTilesets();
        this.scene_render.clearTiggers();
    }

    async sceneSwitch(id: string) {
        this.sceneClose();
        await this.sceneOpen(id);
    }

    play() {
        this.scene_game.run(this.scene_edit.elements);
    }
}

export default SceneMediator;