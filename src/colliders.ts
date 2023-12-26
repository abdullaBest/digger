import { Vector2, Box2, Vector3 } from "./lib/three.module";

interface BoxCollider {
    pos: Vector2;
    width: number;
    height: number;
}

export default class Colliders {
    colliders: { [id: string] : BoxCollider; };
    origin: Vector3;
    normal: Vector3;

    constructor() {
        this.colliders = {};
        this.origin = new Vector3();
        this.normal = new Vector3(0, 0, 1);
    }

    add(id: string, box: Box2) : BoxCollider {
        const collider = {
            width: box.max.x - box.min.x,
            height: box.max.y - box.min.y,
            pos: new Vector2((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2),
        }

        this.colliders[id] = collider;

        return collider;
    }

    remove(id: string) {
        delete this.colliders[id];
    }
}