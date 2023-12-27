import { DynamicBody, SceneCollisions } from "./scene_collisions";

export default class Character {
    body: DynamicBody;

    init(body: DynamicBody) : Character {
        this.body = body;

        return this;
    }

    action(tag: string) {
        switch(tag) {
            case "jump":
                this.body.velocity_y = 0.2;
                break;
            case "move_left":
                this.body.velocity_x = -0.1;
                break;
            case "move_right":
                this.body.velocity_x = 0.1;
                break;
            case "move_stop":
                this.body.velocity_x = 0;
                break;
        }
    }
}