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
        await this.scene_edit.load(id);
        await this.propagate();
        this.events.dispatchEvent(new CustomEvent("scene_open", { detail : {id}}));
    }

    async propagate() {
        const p: Array<Promise<any>> = [];

        for(const id in this.scene_edit.elements) {
            const element = this.scene_edit.elements[id];

            if(element.components.model) {
                this.scene_render.removeModel(id);
                p.push(this.scene_render.addModel(id, element.components.model.properties));
            }
    
            if (element.components.tileset) {
                this.scene_render.removeTileset(id);
                p.push(this.scene_render.addTileset(id, element.components.tileset.properties));
            }
    
            if (element.components.trigger) {
                this.scene_render.removeElement(element.id);
                p.push(this.scene_render.addTriggerElement(element.id, element.components.trigger.properties));
            }
        }

        return Promise.all(p);
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

    play(entrance_id: string | null) {
        this.scene_game.run(this.scene_edit.elements, entrance_id);
    }
}

export default SceneMediator;