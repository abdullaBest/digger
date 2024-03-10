import {
	AssetContentTypeGltf,
	AssetContentTypeModel,
	AssetContentTypeTexture,
	Assets,
} from "../app/assets.js";
import logger from "../core/logger";
import { GLTFLoader } from "../lib/GLTFLoader.js";
import * as SkeletonUtils from "../lib/SkeletonUtils.js";
import * as THREE from "../lib/three.module.js";

import SceneRenderCache from "./scene_render_cache.js";

export default class SceneRenderLoader {
	assets: Assets;
	cache: SceneRenderCache;

	constructor(assets: Assets, cache: SceneRenderCache) {
		this.assets = assets;
		this.cache = cache;
	}

	async loadModel(model: AssetContentTypeModel): Promise<void> {
		const gltf_matter = this.assets.matters.get(
			model.gltf
		) as AssetContentTypeGltf;
		const gltfurl = gltf_matter.url;
		const textureurl = (
			this.assets.matters.get(model.texture) as AssetContentTypeTexture
		).url;

		if (!gltfurl || !textureurl) {
			throw new Error(`Load model errors: wrong ids 
                gltf = [${model.gltf}:${gltfurl}], 
                texture = [${model.texture}:${textureurl}]`);
		}

		if (!this.cache.gltfs[model.gltf]) {
			await this.cacheGltf(gltf_matter, model.gltf);
		}

		if (!this.cache.textures[textureurl]) {
			await this.loadTexture(textureurl, model.texture);
		}
	}

	/**
	 * Parses and stores already loaded gltf
	 */
	cacheGltf(data: any, id: string): Promise<any> {
		if (this.cache.gltfs[id]) {
			return this.cache.gltfs[id];
		}

		const loader = new GLTFLoader();

		// temporarly stores promise into cache
		return (this.cache.gltfs[id] = new Promise((resolve, reject) => {
			loader.parse(
				data,
				".",
				(gltf) => {
					this.cache.gltfs[id] = gltf;
					logger.log(`SceneRenderLoader: gltf ${id} (${data.name}) cached`);
					resolve(gltf);
				},
				reject
			);
		}));
	}

	async loadGltf(url: string, id: string) {
		if (this.cache.gltfs[id]) {
			return this.cache.gltfs[id];
		}

		const loading_manager = new THREE.LoadingManager();
		const loader = new GLTFLoader(loading_manager);
		loading_manager.setURLModifier((path: string) => {
			// 0. blobbed data. Leave as it is
			if (
				path.includes("data:application/octet-stream") ||
				path.includes("data:image") ||
				path.includes("blob")
			) {
				return path;
			}
			// 1. Loads model itself. Same
			if (path.includes(url)) {
				return path;
			}

			// 2. Loads model dependencies. Replaces it with custom path
			// Works with model names so this could produce errors if name was changed
			// on assets base
			logger.warn(
				`SceneRender::loadGltf: gltf ${url} has internal '${path}' dependency. Please reimport`
			);

			const name = path.split("/").pop();
			return `/assets/load?name=${name}`;
		});

		return new Promise((resolve, reject) => {
			loader.load(
				url,
				async (gltf) => {
					this.cache.gltfs[id] = gltf;
					logger.log(
						`SceneRenderLoader: gltf ${id} (${this.assets.matters.get(id)?.name}) loaded`
					);
					resolve(gltf);
				},
				undefined,
				reject
			);
		});
	}

	async loadTexture(url: string, id: string, flipY: boolean = false) {
		let texture = this.getTexture(id);
		if (texture) {
			return texture;
		}

		texture = (await new Promise((resolve, reject) => {
			new THREE.TextureLoader().load(url, resolve, reject);
		})) as THREE.Texture;
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.flipY = flipY;
		this.cache.textures[id] = texture;
		logger.log(
			`SceneRenderLoader: texture ${id} (${
				this.assets.matters.get(id)?.name
			}) loaded`
		);

		return texture;
	}

	getTexture(id: string) {
		return this.cache.textures[id];
	}

	getGltf(id: string) {
		return this.cache.gltfs[id];
	}

	/**
	 * "model" works only with "imported" gltf's wich does not have any internal
	 * links
	 * @param id model asset id
	 * @returns gltf data
	 */
	getModel(id: string, model: AssetContentTypeModel): any {
		const gltf = this.getGltf(model.gltf);
		if (!gltf) {
			throw new Error(
				`SceneRenderLoader::getModel error - ${model.gltf} was not preloaded`
			);
		}

		let scene = null;
		if (!model.filter) {
			scene = SkeletonUtils.clone(gltf.scene);
		} else {
			const filter = model.filter.split(',');
			scene = new THREE.Group();
			for (const i in filter) {
				const f = filter[i];
				const filtered = gltf.scene.getObjectByName(f);
				if (!filtered) {
					console.log(dumpObject(gltf.scene));
					throw new Error(
						`SceneRenderLoader::getModel error - gltf ${model.gltf} does not contain filter requirements "${f}" (${model.filter})`
					);
				}
				scene.add(SkeletonUtils.clone(filtered));
			}

		}

		scene.name = id;

		if (model.matrix?.length) {
			(scene as THREE.Object3D).applyMatrix4(
				new THREE.Matrix4().fromArray(model.matrix)
			);
		}
		if (
			typeof model.pos_x !== "undefined" &&
			typeof model.pos_y !== "undefined"
		) {
			(scene as any).position.x = model.pos_x;
			(scene as any).position.y = model.pos_y;
		}

		// allows to assign different materians for meshes by name
		// such: *_center_*:standart,*:standard_emission
		const materials = [];
		const filters = [];
		const names = [];
		const separator = ":";
		const use_filters = model.material.includes(separator);
		if (!use_filters) {
			materials.push(this.getMaterial(model.material, model.texture));
		} else {
			const f = model.material.split(",");
			for (const i in f) {
				const arg = f[i];
				const args = arg.split(separator);
				const filter = args[0];
				const name = args[1];
				filters.push(filter);
				materials.push(this.getMaterial(name, model.texture));
			}
		}

		scene.traverse((o) => {
			if (!o.isMesh) {
				return;
			}

			if (use_filters) {
				for(let i in filters) {
					const f = filters[i];
					if (o.name.match(f)) {
						o.material = materials[i];
						break;
					}
				}
			} 
			if (!use_filters || !o.material) {
				o.material = materials[0];
			}
			o.receiveShadow = true;
		});

		return scene;
	}

	/**
	 * Creates new material or finds it in cache
	 * @param name material name
	 * @param texture_id preloaded texture id
	 */
	getMaterial(name: string, texture_id: string): THREE.Material {
		const materialTypes = {
			basic: THREE.MeshBasicMaterial,
			standard_emission: THREE.MeshStandardMaterial,
			standart: THREE.MeshStandardMaterial,
			toon: THREE.MeshToonMaterial,
			toon_emission: THREE.MeshToonMaterial,
			sprite: THREE.SpriteMaterial,
		};

		if (!name || !materialTypes[name]) {
			console.warn(
				`SceneRender::getMaterial meterial preset has no type ${name}. Using 'standart'`
			);
			name = "standart";
		}

		const id = `${name}_${texture_id}`;
		if (this.cache.materials[id]) {
			return this.cache.materials[id];
		}

		const texture = this.cache.textures[texture_id];
		if (!texture) {
			throw new Error(
				`SceneRenderLoader::getMaterial error - ${texture_id} was not preloaded`
			);
		}
		texture.colorSpace = THREE.SRGBColorSpace;

		const materialOptions = {
			standart: { roughness: 1 },
			standard_emission: { roughness: 1, emissiveMap : texture, emissive : new THREE.Color(0xffffff), emissiveIntensity: 0.3},
			toon: {},
			toon_emission: { emissiveMap : texture, emissive : new THREE.Color(0xffffff), emissiveIntensity: 0.3},
		};
		const options = Object.assign(
			{ color: 0xffffff, name: id, map: texture },
			materialOptions[name]
		);

		const material = new materialTypes[name](options);
		this.cache.materials[id] = material;

		return material;
	}
}

function dumpObject(
	obj,
	lines: Array<string> = [],
	isLast = true,
	prefix = ""
) {
	const localPrefix = isLast ? "└─" : "├─";
	lines.push(
		`${prefix}${prefix ? localPrefix : ""}${
			obj.name || "*no-name*"
		} [${obj.type}]`
	);
	const newPrefix = prefix + (isLast ? "  " : "│ ");
	const lastNdx = obj.children.length - 1;
	obj.children.forEach((child, ndx) => {
		const isLast = ndx === lastNdx;
		dumpObject(child, lines, isLast, newPrefix);
	});
	return lines;
}
