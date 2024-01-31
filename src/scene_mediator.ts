import SceneGame from "./scene_game";
import SceneMap from "./scene_map";

class SceneMediator {
    scene_game: SceneGame;
    scene_map: SceneMap;
    events: HTMLElement;

    active_scene: string | null;

    constructor(scene_game: SceneGame, scene_core: SceneMap) {
        this.scene_game = scene_game;
        this.active_scene = null;
        this.events = document.createElement("event");
        this.scene_map = scene_core;
    }

    step() {
        if (this.scene_game.requested_map_switch) {
            const scene_id = this.scene_game.requested_map_switch;
            const entrance_id = this.scene_game.requested_map_entrance;
            this.sceneSwitch(scene_id)
            .then(() => this.play(entrance_id))
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
        this.scene_game.run();
        this.events.dispatchEvent(new CustomEvent("scene_open", { detail : {id}}));
    }

    sceneClose() {
        this.events.dispatchEvent(new CustomEvent("scene_close", { detail : {id: this.active_scene}}));
        this.active_scene = null;
        this.scene_game.stop();
    }

    async sceneSwitch(id: string) {
        this.sceneClose();
        await this.sceneOpen(id);
    }

    play(entrance_id?: string | null) {
        this.scene_game.play(entrance_id);
    }
}

export default SceneMediator;