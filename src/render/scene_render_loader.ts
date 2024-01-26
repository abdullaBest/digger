import { Assets, AssetContentTypeModel } from '../assets.js'
import SceneRenderCache from './scene_render_cache.js'
import * as THREE from '../lib/three.module.js';
import { GLTFLoader } from '../lib/GLTFLoader.js';

export default class SceneRenderLoader {
    assets: Assets;
    cache: SceneRenderCache;

    constructor(assets: Assets, cache: SceneRenderCache) {
        this.assets = assets;
        this.cache = cache;
    }

    /**
     * "model" works only with "imported" gltf's wich does not have any internal links
     * @param id model asset id
     * @returns gltf data
     */
    async getModel(id: string, model: any) : Promise<any> {
        const gltfurl = this.assets.get(model.gltf).info.url
        const textureurl = this.assets.get(model.texture).info.url

        if (!gltfurl || !textureurl) {
            throw new Error(
                `Load model errors: wrong ids 
                gltf = [${model.gltf}:${gltfurl}], 
                texture = [${model.texture}:${textureurl}]`
                )
        }
        
        const afterload = async (scene: THREE.Object3D) => {
            scene.name = id;

            if (model.matrix?.length) {
                (scene as THREE.Object3D).applyMatrix4(new THREE.Matrix4().fromArray(model.matrix))
            } 
            if (typeof model.pos_x !== "undefined" && typeof model.pos_y !== "undefined") {
                (scene as any).position.x = model.pos_x;
                (scene as any).position.y = model.pos_y;
            }
            const material = await this.getMaterial(model.material, textureurl);
            scene.traverse((o) => {
                if (!o.isMesh) {
                    return;
                }

                o.material = material;
            });

            //console.log(dumpObject(scene).join('\n'));
        }

        let gltf = this.cache.gltfs[model.gltf];
        if(gltf) {
            const newscene = gltf.scene.clone(true);
            await afterload(newscene);
            return newscene;
        }

        const loading_manager = new THREE.LoadingManager();
        const loader = new GLTFLoader(loading_manager);
        loading_manager.setURLModifier((path: string, s: any, r: any) => {
            if (path.includes(".bin")) {
                console.warn(`SceneRender::addModel: model ${model.gltf} has internal '.bin' dependency. Please reimport`)
                const name = path.split('/').pop();
                return `/assets/load?name=${name}`;
            } else if (path.includes(".png")) {
                console.warn(`SceneRender::addModel: model ${model.gltf} has internal '.png' dependency. Please reimport`)
                return textureurl;
            } else if (path.includes(gltfurl)) {
                return gltfurl;
            }

            return path;
        })


        const load = () => {
            return new Promise((resolve, reject) => {
                loader.load( gltfurl, async ( gltf ) => {
                    this.cache.gltfs[model.gltf] = gltf;
                    const scene = gltf.scene.clone();
                    await afterload(scene);
                    resolve(scene);
                }, undefined,  reject );
            })
        }

        return load();
    }

    unloadModel(model: AssetContentTypeModel) {
        delete this.cache.gltfs[model.gltf];
    }

    /**
     * Creates new material or finds it in cache
     * @param name material name
     * @param texture_url path to lexture
     */
    async getMaterial(name: string, texture_url: string, flipY: boolean = false) : Promise<THREE.Material> {
        const materialTypes = { standart: THREE.MeshStandardMaterial, toon: THREE.MeshToonMaterial, sprite: THREE.SpriteMaterial }

        if(!name || !materialTypes[name]) {
            console.warn(`SceneRender::getMaterial meterial preset has no type ${name}. Using 'standart'`);
            name = "standart";
        }
        
        const id = `${name}_${texture_url}`;
        if (this.cache.materials[id]) {
            return this.cache.materials[id];
        }

        const texture = this.cache.textures[texture_url] ?? await new Promise((resolve, reject) => {
            new THREE.TextureLoader().load( texture_url, resolve, reject );
        });
        this.cache.textures[texture_url] = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = flipY;

        const materialOptions = { 
            standart:  { roughness: 0.7 },
            toon: {}
        }
        const options = Object.assign({color: 0xffffff, name: id, map: texture }, materialOptions[name]);
        const material = new materialTypes[name](options);
        this.cache.materials[id] = material;

        return material;
    }
}