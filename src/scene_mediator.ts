import SceneEdit from "./scene_edit";
import SceneRender from "./scene_render";
import SceneGame from "./scene_game";

class SceneMediator {
    scene_edit: SceneEdit;
    scene_render: SceneRender;
    scene_game: SceneGame;
    events: HTMLElement;

    active_scene: string | null;

    constructor(scene_edit, scene_render, scene_game) {
        this.scene_edit = scene_edit;
        this.scene_game = scene_game;
        this.scene_render = scene_render;
        this.active_scene = null;
        this.events = document.createElement("event");
    }

    step() {
        if (this.scene_game.requested_map_switch) {
            this.sceneSwitch(this.scene_game.requested_map_switch)
            .then(() => this.play())
            .catch((err) => {
                this.sceneClose();
                console.error("Scene requested switch error: ", err);
            });
        }
    }

    async sceneOpen(id: string) {
        if(this.active_scene) {
            throw new Error("SceneMediator::sceneOpen. Can't open new scene before active one closed.");
        }

        this.active_scene = id;
        await this.scene_edit.load(id);
        this.events.dispatchEvent(new CustomEvent("scene_open", { detail : {id}}));
    }

    sceneClose() {
        this.active_scene = null;
        this.scene_game.stop();
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