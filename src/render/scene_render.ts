import * as THREE from "../lib/three.module.js";
import { GLTFLoader } from "../lib/GLTFLoader.js";
import { OrbitControls } from "../lib/OrbitControls.js";
import { Assets } from "../app/assets.js";
import SceneMath from "./scene_math.js";
import {
	SceneCollisions,
	BoxColliderC,
	ColliderType,
} from "../app/scene_collisions.js";
import { lerp, distlerp } from "../core/math.js";
import SceneRenderCache from "./scene_render_cache.js";
import SceneRenderLoader from "./scene_render_loader.js";
import { focusCameraOn, setCameraPos, setObjectPos } from "./render_utils.js";
import { GridWaveShaderMaterial } from "./vfx_shader_materials";

const RENDER_GAMMA = 1.2;
const RENDER_EXPOSURE = 3.0

const SPRITE_DEFAULT_PATH = "./res/sprites/";

class SceneRender {
	canvas: HTMLCanvasElement;
	canvas_container: HTMLElement | null | undefined;

	camera_base_fov: number;

	private cube: THREE.Mesh;
	renderer: THREE.WebGLRenderer;
	rootscene: THREE.Scene;
	global_lights: THREE.Group;
	scene: THREE.Group;

	// this group made for sprites that serves as "light"
	fakelights_scene: THREE.Scene;
	fakelights_render_enabled: boolean;
	fakelights_render_target: THREE.WebGLRenderTarget;

	// postprocess holds render layers results
	postprocess_scene: THREE.Scene;
	postprocess_camera: THREE.OrthographicCamera;
	postprocess_enabled: boolean;
	scene_render_target: THREE.WebGLRenderTarget;

	camera: THREE.PerspectiveCamera;
	controls: OrbitControls;

	scene_math: SceneMath;
	assets: Assets;
	cache: SceneRenderCache;
	loader: SceneRenderLoader;

	constructor(assets: Assets) {
		this.assets = assets;
		this.cache = new SceneRenderCache();

		this.scene_math = SceneMath.instance;
		this.loader = new SceneRenderLoader(this.assets, this.cache);
		this.camera_base_fov = 45;
		this.postprocess_enabled = true;
		this.fakelights_render_enabled = true;
	}

	_initCore(canvas: HTMLCanvasElement) {
		const rootscene = new THREE.Scene();
		const scene = new THREE.Group();
		rootscene.add(scene);
		const camera = new THREE.PerspectiveCamera(
			this.camera_base_fov,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
		//renderer.shadowMap.enabled = true;
		this.canvas_container = canvas.parentElement;
		this.canvas = canvas;

		this.renderer = renderer;
		this.scene = scene;
		this.rootscene = rootscene;
		this.camera = camera;
	}

	_initPostprocess() {
		const postprocess_scene = new THREE.Scene();
		const postprocess_camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const fakelights_scene = new THREE.Scene();
		this.scene_render_target = new THREE.WebGLRenderTarget();

		this.fakelights_render_target = new THREE.WebGLRenderTarget();
		this.fakelights_render_target.depthBuffer = false;

		this.fakelights_scene = fakelights_scene;
		this.postprocess_scene = postprocess_scene;
		this.postprocess_camera = postprocess_camera;

		this.postprocess_scene.add(
			new THREE.Mesh(
				new THREE.PlaneGeometry(2, 2),
				new THREE.RawShaderMaterial({
					name: "Post-FX Shader",
					vertexShader: 
`
in vec3 position;
in vec2 uv;

out vec2 vUv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,
					fragmentShader:
`
precision highp float;
precision highp int;

layout(location = 0) out vec4 pc_FragColor;

in vec2 vUv;

uniform sampler2D texture_main;
uniform sampler2D texture_fakelights;

uniform float exposure;
uniform float gamma;

void main() {
	vec4 background = vec4(1.0, 1.0, 1.0, 1.0);
	vec4 diffuse = texture( texture_main, vUv );
	vec4 lights = texture( texture_fakelights, vUv );
	lights += background * (1.0 - lights.a);
	
	vec4 color = diffuse * lights;

	vec3 hdrColor = color.rgb;

	// exposure tone mapping
	vec3 mapped = vec3(1.0) - exp(-hdrColor * exposure);
	// gamma correction 
	mapped = pow(mapped, vec3(1.0 / gamma));

	pc_FragColor = vec4(mapped, color.a);
}
`,
					uniforms: {
						texture_main: { value: this.scene_render_target.texture },
						texture_fakelights: {
							value: this.fakelights_render_target.texture,
						},
						exposure: { value: RENDER_EXPOSURE },
						gamma: { value: RENDER_GAMMA }
					},
					glslVersion: THREE.GLSL3,
					depthWrite: false
				})
			)
		);
	}

	init(canvas: HTMLCanvasElement): SceneRender {
		this._initCore(canvas);
		this._initPostprocess();
		const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
		const cube = new THREE.Mesh(geometry, material);
		this.scene.add(cube);

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.screenSpacePanning = true;

		(this.camera as any).position.z = 2;

		this.cube = cube;

		this.initLights();
		this.updateSize();

		return this;
	}

	initLights() {
		this.global_lights = new THREE.Group();
		this.rootscene.add(this.global_lights);

		const light1 = new THREE.AmbientLight(0xffffff, 0.7);
		light1.name = "ambient_light";
		this.global_lights.add(light1);

		const light2 = new THREE.DirectionalLight(0xffffff, 2.3);
		(light2 as any).position.set(0.5, 1, -0.866); // ~60º
		light2.name = "main_light";
		this.global_lights.add(light2);
		//light2.castShadow = true;

		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 3.2);
		hemiLight.name = "hemi_light";
		this.global_lights.add(hemiLight);
	}

	addModel(
		id: string,
		model: any,
		parent?: THREE.Object3D | null
	): THREE.Object3D {
		const object = this.loader.getModel(id, model);
		return this.addObject(id, object, parent);
	}

	addObject(
		id: string,
		object: THREE.Object3D,
		parent: THREE.Object3D | null = this.scene
	): THREE.Object3D {
		this.cache.objects[id] = object;
		object.name = id;
		(parent ?? this.scene).add(object);

		return object;
	}

	removeObject(id: string) {
		const object = this.cache.objects[id];
		if (object) {
			object.removeFromParent();
			delete this.cache.objects[id];
		}
	}

	removeGLTF(id: string) {
		this.removeObject(id);
		delete this.cache.gltfs[id];
	}

	addEmptyObject(id: string, parent?: THREE.Object3D | null): THREE.Object3D {
		const object = new THREE.Object3D();
		return this.addObject(id, object, parent);
	}

	async addTriggerElement(id: string, properties: any) {
		const type = properties.type;
		const spritenames = {
			mapentry: "character_place",
			mapexit: "character_lift",
			unknown: "hexagon_question",
		};
		let spritename = spritenames[type] || spritenames.unknown;

		const sprite = await this.makeSprite(spritename);

		sprite.name = id;
		this.scene.add(sprite);
		this.cache.objects[id] = sprite;

		if (properties.pos_x || properties.pos_y) {
			this.setPos(
				sprite,
				this.cache.vec3_0.set(properties.pos_x ?? 0, properties.pos_y ?? 0, 0)
			);
		}
	}

	async makeSprite(
		name: string,
		parent?: THREE.Object3D
	): Promise<THREE.Sprite> {
		const spritepath = SPRITE_DEFAULT_PATH + name + ".png";
		const sprite = new THREE.Sprite(
			(await this.getLoadMaterial(
				"sprite",
				spritepath,
				true
			)) as THREE.SpriteMaterial
		);

		if (parent) {
			parent.add(sprite);
		}

		return sprite;
	}

	async makeSprite3d(
		name: string,
		parent?: THREE.Object3D
	): Promise<THREE.Mesh> {
		const spritepath = SPRITE_DEFAULT_PATH + name + ".png";
		const material = (await this.getLoadMaterial(
			"basic",
			spritepath,
			true
		)) as THREE.SpriteMaterial;

		const geometry = new THREE.PlaneGeometry(1, 1);
		const sprite = new THREE.Mesh(geometry, material as any);
		if (parent) {
			parent.add(sprite);
		}

		return sprite;
	}

	clearCached() {
		for (const k in this.cache.objects) {
			this.removeObject(k);
		}
	}

	async viewModel(id: string, model: any) {
		this.clearCached();
		const scene = await this.addModel(id, model);
		this.focusCameraOn(scene);
	}

	addGLTF(url: string, name?: string): Promise<any> {
		return new Promise((resolve, reject) => {
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

				// 2. Loads model dependencies. Replace it with custom path
				// Works with model names so this could produce errors
				const name = path.split("/").pop();
				return `/assets/load?name=${name}`;
			});

			loader.load(
				url,
				(gltf) => {
					this.scene.add(gltf.scene);
					let id = name ?? "g_" + this.cache.guids++;
					gltf.scene.name = id;
					this.cache.gltfs[id] = gltf;
					this.cache.objects[id] = gltf.scene;
					resolve(gltf);
				},
				undefined,
				(error) => {
					console.error(error);
					reject(error);
				}
			);
		});
	}

	/**
	 * Basic way to display model.
	 * Resolves internal urls by asset name.
	 * @param url gltf file url
	 */
	async viewGLTF(url: string): Promise<THREE.Object3D> {
		this.clearCached();
		const gltf = await this.addGLTF(url);
		this.focusCameraOn(gltf.scene);
		return gltf;
	}

	focusCameraOn(object: THREE.Object3D) {
		focusCameraOn(
			object,
			this.camera,
			this.cache.vec3_0.set(1, 1, 1),
			this.controls
		);
	}

	/**
	 * Creates new material or finds it in cache
	 * @param name material name
	 * @param texture_url path to lexture
	 */
	async getLoadMaterial(
		name: string,
		texture_url: string,
		flipY: boolean = false
	): Promise<THREE.Material> {
		await this.loader.loadTexture(texture_url, texture_url, flipY);
		return this.loader.getMaterial(name, texture_url);
	}

	step(dt: number) {
		this.updateSize();

		this.cube.rotateX(0.01);
		this.cube.rotateY(0.01);
	}

	render() {
		const width = this.getRenderWidth();
		const height = this.getRenderHeight();

		this.renderer.autoClear = true;
		this.renderer.setViewport(0, 0, width, height);

		if (this.postprocess_enabled) {

			// render fake lights into texture
			if (this.fakelights_render_enabled) {
				this.renderer.setRenderTarget(this.fakelights_render_target);
				this.renderer.render(this.fakelights_scene, this.camera);
			}

			// render scene itself into texture
			this.renderer.setRenderTarget(this.scene_render_target);
			this.renderer.render(this.rootscene, this.camera);

			// render rendered textures into canvas
			this.renderer.setRenderTarget(null);
			this.renderer.render(this.postprocess_scene, this.postprocess_camera);

			return;
		}

		// main scene render
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.rootscene, this.camera);
	}

	/**
	 * attaches scene canvas to new parent node
	 * @param newel new element to attach canvas
	 */
	reattach(newel: HTMLElement) {
		if (newel == this.canvas_container) {
			return;
		}

		this.canvas.parentElement?.removeChild(this.canvas);
		newel.appendChild(this.canvas);
		this.canvas_container = newel;
		this.updateSize();
	}

	getRenderWidth() {
		return Math.floor(this.canvas_container?.offsetWidth || 100);
	}

	getRenderHeight() {
		return Math.floor(this.canvas_container?.offsetHeight || 100);
	}

	private updateSize() {
		this.renderer.getSize(this.cache.vec2_0);
		const width = this.getRenderWidth();
		const height = this.getRenderHeight();
		if (
			this.cache.vec2_0.width != width ||
			this.cache.vec2_0.height != height
		) {
			this.renderer.setSize(width, height);
			this.updateCameraAspect(width, height);

			if (this.postprocess_enabled) {
				this.scene_render_target.setSize(width, height);
				if (this.fakelights_render_enabled) {
					this.fakelights_render_target.setSize(width, height);
				}
			}
		}
	}

	updateCameraAspect(
		width = this.getRenderWidth(),
		height = this.getRenderHeight()
	) {
		this.camera.aspect = width / height;
		this.camera.fov = this.camera_base_fov * Math.min(1, width / height);
		this.camera.updateProjectionMatrix();
	}

	/**
	 * Avoiding typescript errors
	 * @param o
	 * @param pos
	 */
	setPos(o: THREE.Object3D, pos: THREE.Vector3) {
		setObjectPos(o, pos);
	}

	setCameraPos(pos: THREE.Vector3, target: THREE.Vector3) {
		setCameraPos(pos, target, this.camera, this.controls);
	}

	testSphereAdd(
		pos: THREE.Vector3,
		size: number = 0.1,
		color: number = 0xffffff
	) {
		const geometry = new THREE.SphereGeometry(size);
		const material = new THREE.MeshBasicMaterial({ color });
		const sphere = new THREE.Mesh(geometry, material);
		this.setPos(sphere, pos);
		this.scene.add(sphere);
		return sphere;
	}
}

export default SceneRender;
