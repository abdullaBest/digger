import SceneCore from "../scene_core";
import Character from "../character";
import { BoxColliderC } from "../scene_collisions";

export default class SystemObjectsBreak {
    scene_core: SceneCore;
    breakable_objects: { [id: string]: number }
    constructor(scene_core: SceneCore) {
        this.scene_core = scene_core;
    }

    run() {
        this.breakable_objects = {};
    }

    /**
     * 
     * @param id hit object
     * @returns true if objet durability set and it less/equals zero
     */
    hit(id: string) : boolean {
        
        const hit_damage = 1;
        const hit_strength = 1;

        // hit result is collider. Breakable component has to be found somehere in tree
        let component = this.scene_core.components[id] as any;
        while(component && !component.gameprop && component.owner) {
            component = this.scene_core.matters.get(component.owner);
        }
        if (!component || !component.gameprop) {
            return false;
        }

        component = this.scene_core.matters.get(component.gameprop)

        let durability = component.durability;
        let resistance = component.resistance;

        if (hit_strength < resistance) {
            return false;
        }
        
        durability -= hit_damage;

        component.durability = Math.max(0, durability);
        return durability <= 0;
    }

    
    _actionHitCollisionTest(cha: Character, colliders: {[id: string] : BoxColliderC}): string | null {
        const tile_size = 1;
        const ray_size = tile_size * 0.9;
        // default in center
        let test_l = cha.body.collider.x;
        let test_r = cha.body.collider.x;
        let test_t = cha.body.collider.y;
        let test_b = cha.body.collider.y;

        // shift ray towards look x direction.
        // Y look direction in priority
        if (!cha.look_direction_y) {
            test_l = cha.body.collider.x + cha.body.collider.width * 0.5 * cha.look_direction_x + ray_size * cha.look_direction_x;
            test_r = cha.body.collider.x + cha.body.collider.width * 0.5 * cha.look_direction_x + ray_size * cha.look_direction_x;
            test_t = cha.body.collider._top - 0.01;
            test_b = cha.body.collider._bottom + 0.01;
        } else {
            test_t = cha.body.collider.y + cha.body.collider.height * 0.5 * cha.look_direction_y + ray_size * cha.look_direction_y;
            test_b = cha.body.collider.y + cha.body.collider.height * 0.5 * cha.look_direction_y + ray_size * cha.look_direction_y;
            test_r = cha.body.collider._right - 0.01;
            test_l = cha.body.collider._left + 0.01;
        }
        let hit_collider: string | null = null;
        for(const k in colliders) {
            const c = colliders[k];
            const collides_x = test_l <= c._right && c._left <= test_r;
            const collides_y = test_b <= c._top && c._bottom <= test_t;
            if (collides_x && collides_y) {
                hit_collider = k;
                break;
            }
        }

        return hit_collider;
    }
}