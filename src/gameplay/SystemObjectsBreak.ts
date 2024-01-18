import SceneMap from "../scene_map";
import Character from "../character";
import { BoxColliderC } from "../scene_collisions";

export default class SystemObjectsBreak {
    scene_map: SceneMap;
    breakable_objects: { [id: string]: number }
    constructor(scene_map: SceneMap) {
        this.scene_map = scene_map;
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

        const durability = this.breakable_objects[id] ?? this.scene_map.entities[id]?.components.model?.properties.durability;
        if (!durability) {
            return false;
        }

        let endurance = (durability & 0xF0) >> 4;
        let resistance = durability & 0x0F;
        if (durability > 0xFF) {
            endurance = (durability & 0xFF) >> 8;
            resistance = durability & 0x00FF;
        }

        if (hit_strength < resistance) {
            return false;
        }
        
        endurance -= hit_damage;
        if (endurance > 0) {
            let newdurability = ((endurance << 4) & 0xF0) + ((resistance) & 0x0F);
            if (durability > 0xFF) {
                newdurability = ((endurance << 8) & 0xFF00) + ((resistance) & 0x00FF);
            }

            this.breakable_objects[id] = newdurability;
            return false;
        }

        return true;
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