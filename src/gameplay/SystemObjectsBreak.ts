import SceneMap from "../scene_map";

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
}