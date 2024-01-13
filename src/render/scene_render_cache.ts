
import { Vector2, Vector3, Material, Texture, Mesh } from '../lib/three.module.js';

export default class SceneRenderCache {
    constructor() {
        this.vec2_0 = new Vector2();
        this.vec3_0 = new Vector3();
        this.vec3_1 = new Vector3();
        this.gltfs = {};
        this.models = {};
        this.triggers = {};
        this.materials = {};
        this.textures = {};
        this.debug_colliders = {};
        this.guids = 0;
    }
    
    vec2_0: Vector2;
    vec3_0: Vector3;
    vec3_1: Vector3;

    // used for gltfs cache
    gltfs: { [id: string] : any; };
    // used for 3d objects
    objects: { [id: string] : any; };
    // stores pointers to models data
    // tynroar note: probably bad and unsafe idea
    models: { [id: string] : any; };
    triggers: { [id: string] : any; };
    materials: { [id: string] : Material; };
    textures: { [id: string] : Texture; };
    debug_colliders: { [id: string] : Mesh; };
    guids: number;
}