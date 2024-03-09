import SceneDiggerGame from "../gameplay/scene_digger_game";
import { AssetContentTypeComponent } from "../app/assets";
import SceneMap from "./scene_map";
import Events from "../core/events";

class SceneMediator {
    scene_game: SceneDiggerGame;
    scene_map: SceneMap;
    events: Events;

    active_scene: string | null;

    constructor(scene_game: SceneDiggerGame, scene_map: SceneMap) {
        this.scene_game = scene_game;
        this.active_scene = null;
        this.events = new Events();
        this.scene_map = scene_map;
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
				const matter = this.scene_map.scene_core.matters.get(id);
				await this.scene_map.add(matter as AssetContentTypeComponent);
        await this.scene_game.play();
				this.events.emit("scene_open", { id });
    }

    sceneClose() {
			this.events.emit("scene_close", { id: this.active_scene });
			this.active_scene = null;
			this.scene_game.stop();
    }

    async sceneSwitch(id: string) {
        this.sceneClose();
        await this.sceneOpen(id);
    }

    async play(entrance_id?: string | null) {
        await this.scene_game.play(entrance_id);
    }
}

export default SceneMediator;
