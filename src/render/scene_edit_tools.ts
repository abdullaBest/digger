import * as THREE from "../lib/three.module.js";
import { TransformControls } from "../lib/TransformControls.js";
import SceneCollisions from "../scene_collisions";
import SceneRender from "./scene_render";
import TilesetEditor from "./tileset_editor";
import { setObjectPos } from "./render_utils";
import { snap } from "../math";
import { SceneCore, MapComponent } from "../scene_core";
import SceneMap from "../scene_map";

import {
	Assets,
	AssetContentTypeComponent,
	AssetContentTypeWireplug,
} from "../assets";
import {
	MapTilesetSystem,
	SceneEditWireplugsSystem,
} from "../systems/index";

enum SceneEditToolMode {
	DEFAULT = 0,
	TRANSLATE = 1,
	ROTATE = 2,
	SCALE = 3,
	TILE_DRAW = 4,
	TILE_ERASE = 5,
	WIRES = 6,
}

class SceneEditTools {
	/**
	 * Relative screen coords (-1;1)
	 */
	private mousepos: THREE.Vector2;
	private mousepos_abs: THREE.Vector2;
	private mousepressed: boolean;

	/**
	 * position will be aligned to selected tileset
	 */
	private mousepos_world: THREE.Vector3;

	transform_controls: TransformControls;
	private raycaster: THREE.Raycaster;

	assets: Assets;
	scene_render: SceneRender;
	tileset_editor: TilesetEditor;
	scene_collisions: SceneCollisions;
	scene_core: SceneCore;
	scene_map: SceneMap;

	wireset_line?: THREE.Line | null;

	editmode: SceneEditToolMode;

	private cube: THREE.Mesh;

	constructor(
		scene_render: SceneRender,
		scene_collisions: SceneCollisions,
		scene_map: SceneMap,
		assets: Assets
	) {
		this.scene_render = scene_render;
		this.scene_collisions = scene_collisions;
		this.scene_map = scene_map;
		this.scene_core = scene_map.scene_core;
		this.assets = assets;

		this.mousepos = new THREE.Vector2();
		this.mousepos_world = new THREE.Vector3();
		this.mousepos_abs = new THREE.Vector2();
		this.raycaster = new THREE.Raycaster();
		this.mousepressed = false;
		this.tileset_editor = new TilesetEditor(
			this.scene_core,
			this.scene_render.loader
		);
		this.editmode = SceneEditToolMode.DEFAULT;
	}

	init() {
		this.tileset_editor.init();

		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.7,
		});
		const cube = new THREE.Mesh(geometry, material);
		this.scene_render.scene.add(cube);
		cube.visible = false;
		this.cube = cube;

		this.transform_controls = new TransformControls(
			this.scene_render.camera,
			this.scene_render.renderer.domElement
		);
		this.transform_controls.addEventListener("mouseDown", (event) => {
			this.scene_render.controls.enabled = false;
		});
		this.transform_controls.addEventListener("mouseUp", (event) => {
			this.scene_render.controls.enabled = true;
		});
		this.scene_render.rootscene.add(this.transform_controls);

		let localMouse = { x: 0, y: 0 };
		this.scene_render.canvas.addEventListener("mousedown", (ev: MouseEvent) => {
			localMouse.x = ev.clientX;
			localMouse.y = ev.clientY;
			this.mousepressed = true;
		});
		this.scene_render.canvas.addEventListener("mouseup", (ev: MouseEvent) => {
			const deltax = Math.abs(ev.clientX - localMouse.x);
			const deltay = Math.abs(ev.clientY - localMouse.y);
			if (deltax + deltay < 10) {
				this.onMouseClick(ev);
			}
			this.mousepressed = false;
			this.scene_render.controls.enableRotate = true;
			this.onMouseUp(ev);
		});

		this.scene_render.canvas.addEventListener("mousemove", (ev: MouseEvent) => {
			this.onMouseMove(ev);
		});
	}

	pickObject(
		pos: THREE.Vector2,
		camera: THREE.Camera,
		nodes: Array<THREE.Object3D>,
		list: { [id: string]: THREE.Object3D }
	): THREE.Object3D | null {
		this.raycaster.setFromCamera(pos, camera);
		const intersects = this.raycaster.intersectObjects(nodes, true);

		let object: THREE.Object3D | null = null;
		for (const i in intersects) {
			const intersect = intersects[i];
			let o = intersect.object;
			while (o) {
				if (list[o.name]) {
					object = o;
					break;
				}
				o = o.parent;
			}
			if (object) {
				break;
			}
		}

		return object;
	}

	onMouseMove(ev) {
		const event = ev as any;
		event.preventDefault();

		this.mousepos_abs.x = event.layerX;
		this.mousepos_abs.y = event.layerY;
		this.mousepos.x = (event.layerX / event.target.offsetWidth) * 2 - 1;
		this.mousepos.y = -(event.layerY / event.target.offsetHeight) * 2 + 1;

		if (this.mousepressed) {
		}

		this.raycaster.setFromCamera(this.mousepos, this.scene_render.camera);
		const pos = this.scene_render.scene_math.intersectRayPlane(
			this.raycaster.ray.origin,
			this.raycaster.ray.direction,
			this.scene_collisions.origin,
			this.scene_collisions.normal
		); //cache.vec3_0

		if (pos && this.isInTileEditMode()) {
			pos.x = snap(pos.x, this.tileset_editor.tilesize_x);
			pos.y = snap(pos.y, this.tileset_editor.tilesize_y);

			if (this.tileset_editor.selected_tileset) {
				const tileset = this.scene_core.components[
					this.tileset_editor.selected_tileset
				] as AssetContentTypeComponent;
				if (tileset) {
					pos.x += (tileset.pos_x ?? 0) % 1;
					pos.y += (tileset.pos_y ?? 0) % 1;
				}
			}

			setObjectPos(this.cube, pos);
		}

		if (pos) {
			this.mousepos_world.copy(pos);
		}

		this.moveWireDrag();
	}

	onMouseUp(ev: MouseEvent) {
		this.finishWireDrag();
	}

	onMouseClick(ev: MouseEvent) {
		if (ev.button !== 0) {
			return;
		}
		const event = ev as any;
		event.preventDefault();

		// pick sidebar
		const sidebar_box = this.getSidebarSize();
		if (sidebar_box.containsPoint(this.mousepos_abs)) {
			const x = this.mousepos_abs.x - sidebar_box.min.x;
			const y = this.mousepos_abs.y - sidebar_box.min.y;
			this.mousepos.x = (event.layerX / event.target.offsetWidth) * 2 - 1;
			this.mousepos.y = -(event.layerY / event.target.offsetHeight) * 2 + 1;
			const size = sidebar_box.getSize(this.scene_render.cache.vec2_0);
			const rx = (x / size.x) * 2 - 1;
			const ry = -(y / size.y) * 2 + 1;
			const object = this.pickObject(
				this.scene_render.cache.vec2_0.set(rx, ry),
				this.tileset_editor.camera,
				this.tileset_editor.scene.children,
				this.tileset_editor.objects
			);
			if (object) {
				this.tileset_editor.pickObject(object.name);
			}

			return;
		}

		if (
			this.editmode == SceneEditToolMode.TRANSLATE ||
			this.editmode == SceneEditToolMode.ROTATE ||
			this.editmode == SceneEditToolMode.SCALE
		) {
			// pick on scene
			const object = this.pickObject(
				this.mousepos,
				this.scene_render.camera,
				this.scene_render.scene.children,
				this.scene_render.cache.objects
			);

			if (object) {
				console.log("transform attached to " + object.name);
				this.transform_controls.attach(object);
			}
		} else if (this.isInTileEditMode()) {
			this.tilesetDraw();
		} else if (this.editmode == SceneEditToolMode.WIRES) {
		}
	}

	async tilesetDraw() {
		const drawobject = this.tileset_editor.slected_object;
		if (!this.tileset_editor.selected_tileset) {
			return;
		}

		if (!drawobject && this.editmode == SceneEditToolMode.TILE_DRAW) {
			return;
		}

		const tileset_id = this.tileset_editor.selected_tileset;
		const tileset = (this.scene_core.systems.tileset as MapTilesetSystem)
			.tilesets[tileset_id];

		if (!tileset) {
			return;
		}

		const canvas = tileset.canvas;
		const image = tileset.image;

		if (!image) {
			return;
		}

		const pos_x = this.mousepos_world.x;
		const pos_y = this.mousepos_world.y;
		const rpos_x = pos_x - tileset.pos_x;
		const rpos_y = pos_y - tileset.pos_y;

		if (
			rpos_x < 0 ||
			rpos_y > 0 ||
			rpos_x >= image.width ||
			rpos_y >= image.height
		) {
			throw new Error("Can't draw outside tileset bounds.");
		}

		let drawcolor = tileset.tileset.zero_color;
		const newid = "i" + tileset.makeTileId(rpos_x, rpos_y);

		if (drawobject && this.editmode == SceneEditToolMode.TILE_DRAW) {
			this.scene_core.remove(newid);
			if (this.scene_core.matters.get(newid)) {
				this.scene_core.matters.remove(newid);
			}
			const drawid = drawobject.name;
			drawcolor = this.tileset_editor.colors[drawid];
			const ref = this.scene_core.matters.get(
				drawid
			) as AssetContentTypeComponent;
			const instance = await this.scene_core.add(ref, null, newid);
			if (instance) {
				instance.pos_x = rpos_x;
				instance.pos_y = rpos_y;
				const object = this.scene_render.cache.objects[instance.id];
				this.scene_render.setPos(object, new THREE.Vector3(rpos_x, rpos_y, 0));
			}
		} else if (this.editmode == SceneEditToolMode.TILE_ERASE) {
			this.scene_core.remove(newid);
		}

		const ctx = canvas.getContext("2d");

		if (canvas && image && ctx) {
			canvas.width = image.width;
			canvas.height = image.height;
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(image, 0, 0);
			ctx.rect(rpos_x, -rpos_y, 1, 1);
			ctx.fillStyle = drawcolor;
			ctx.fill();
			image.src = canvas.toDataURL();
		}

		this.tileset_editor.changed_tilesets[tileset_id] =
			(this.tileset_editor.changed_tilesets[tileset_id] ?? 0) + 1;
	}

	/**
	 *
	 * @param id model id
	 */
	attachTransformControls(id: string) {
		const object = this.scene_render.cache.objects[id];
		if (object) {
			this.transform_controls.attach(object);
		}
	}

	step(dt: number) {
		if (
			this.transform_controls.object &&
			!this.transform_controls.object.parent
		) {
			this.transform_controls.detach();
		}

		this.tileset_editor.step(dt);
	}

	render() {
		// render ui
		this.scene_render.renderer.clearDepth();
		const sidebar_size = this.getSidebarSize();
		this.scene_render.renderer.setViewport(
			sidebar_size.min.x,
			sidebar_size.min.y,
			sidebar_size.max.x - sidebar_size.min.x,
			sidebar_size.max.y - sidebar_size.min.y
		);
		this.scene_render.renderer.autoClear = false;
		this.scene_render.renderer.render(
			this.tileset_editor.rootscene,
			this.tileset_editor.camera
		);
		this.scene_render.renderer.autoClear = true;
	}

	getSidebarSize() {
		const padding = 16;

		const width = this.scene_render.getRenderWidth();
		const height = this.scene_render.getRenderHeight();
		const box = this.scene_render.cache.box2_0;

		box.max.x = width - padding;
		box.min.x =
			box.max.x -
			this.tileset_editor.palette_w * (height / this.tileset_editor.palette_h);
		box.min.y = padding;
		box.max.y = height - padding;

		return box;
	}

	setEditMode(mode: SceneEditToolMode) {
		if (this.editmode == mode) {
			return;
		}

		this.scene_core.removeSystem("wires_edit");

		this.editmode = mode;
		this.cube.visible = false;
		this.transform_controls.visible = true;

		switch (mode) {
			case SceneEditToolMode.DEFAULT:
				break;
			case SceneEditToolMode.TRANSLATE:
				this.transform_controls?.setMode("translate");
				break;
			case SceneEditToolMode.ROTATE:
				this.transform_controls?.setMode("rotate");
				break;
			case SceneEditToolMode.SCALE:
				this.transform_controls?.setMode("scale");
				break;
			case SceneEditToolMode.TILE_DRAW:
				this.transform_controls.visible = false;
				this.cube.visible = true;
				this.cube.material.color.set(0, 1, 0);
				break;
			case SceneEditToolMode.TILE_ERASE:
				this.transform_controls.visible = false;
				this.cube.material.color.set(1, 0, 0);
				this.cube.visible = true;
				break;
			case SceneEditToolMode.WIRES:
				this.setEditModeWires();
				break;
		}
	}

	setEditModeWires() {
		this.transform_controls.visible = false;
		const wires_edit_system = new SceneEditWireplugsSystem(
			this.scene_render,
			this.scene_core.matters
		);
		this.scene_core.addSystem("wires_edit", wires_edit_system);
		let wirefrom = "";
		wires_edit_system.events.on("dragstart", (id) => {
			this.startWireDrag(id);
			wirefrom = id;
		});
		wires_edit_system.events.on("dragend", async (id) => {
			await this.finishWireDrag(wirefrom, id);
		});
		wires_edit_system.events.on("propchange", async ({ key, value, id }) => {
			const newinstance = await this.applyComponentChanges(id, (component) => {
				component.set(key, value);
			});

			// restore input selection (cause it was recreated)
			if (newinstance) {
				const query = `#frame-edit-wireplug-${newinstance.id} #input-edit-wireplug-${key} input`;
				const input = document.querySelector(query) as HTMLInputElement;
				if (input) {
					input.focus();
				}
			}
		});
	}

	moveWireDrag() {
		if (!this.wireset_line) {
			return;
		}
		const positions = this.wireset_line.geometry.attributes.position.array;
		positions[3] = this.mousepos_world.x;
		positions[4] = this.mousepos_world.y;
		positions[5] = 0;
		this.wireset_line.geometry.attributes.position.needsUpdate = true;
	}

	startWireDrag(id: string) {
		const wireplug = this.scene_core.components[id];
		const object = this.scene_render.cache.objects[wireplug.owner];
		const pos = object.getWorldPosition(this.scene_render.cache.vec3_0);
		const vertices = [pos.x, pos.y, pos.z, pos.x, pos.y, 0];
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(vertices, 3)
		);
		const material = new THREE.LineBasicMaterial({
			color: 0xffffff,
			linewidth: 10,
			depthTest: false,
		});
		const line = new THREE.Line(geometry, material);
		line.renderOrder = 1;
		this.scene_render.addObject("wireset_line", line);
		this.wireset_line = line;
	}

	/**
	 * @brief use that function for making savable changes on scene
	 * if component instance inherited directly from asset source it creates new asset so it safe to edit.
	 * deletes prev instance on scene, calls change function argument and readds new instance into scene
	 *
	 * @param id {string} component id. Has to be at scene at that moment
	 * @param change {Function<void>} function that should apply changes
	 * @param name {string} subcomponent name (field key) in owner component
	 * @return
	 */
	async applyComponentChanges(
		id: string,
		change: (component: AssetContentTypeComponent) => void,
		name?: string
	) : Promise<AssetContentTypeComponent | null> {
		const matters = this.scene_core.matters;

		const component_instance = matters.get(id) as AssetContentTypeComponent;
		let component = matters.get(
			component_instance.inherites
		) as AssetContentTypeWireplug;

		// so.. by default subcomponents intances inherited directly
		// from asset matter.
		// New asset has to be created if required.
		// ---
		// a. instance owner (main component instance)
		const a = matters.get(component_instance.owner);
		// b. component asset (the one that added into scene)
		const b = matters.get(a.inherites);

		// remove instance before setting new subcomponents
		// or changing any data
		this.scene_core.remove(a.id);

		// c. owner of wireplug component differs
		// means that new component has to be added onto scene
		if (component.owner !== b.id) {
			// same approach as in SceneEditView.addComponent
			const extension = component.get("type");
			const global_id = await this.assets.uploadComponent(
				{
					inherites: component.inherites,
					owner: b.id,
					name: "c-" + component.name,
				},
				extension
			);

			// add new link into component
			b.set_link(name || extension, global_id);

			component = matters.get(global_id) as AssetContentTypeWireplug;
		}

		change(component);

		return this.scene_core.add(b as AssetContentTypeComponent);
	}

	async finishWireDrag(from?: string, to?: string) {
		if (this.wireset_line) {
			this.wireset_line.removeFromParent();
			this.wireset_line = null;
		}

		if (!from || !to || from == to) {
			return;
		}

		const matters = this.scene_core.matters;
		this.applyComponentChanges(from, (wireplug: AssetContentTypeWireplug) => {
			// a. subcomponent (wireplug) instance
			const otherplug_instance = matters.get(to) as AssetContentTypeComponent;
			// b. owner of that wireplug instance
			const opi_owner_instance = matters.get(otherplug_instance.owner);
			// c. source asset component
			const other_component = matters.get(
				opi_owner_instance.inherites
			) as AssetContentTypeComponent;

			const wires_edit_system = this.scene_core.systems[
				"wires_edit"
			] as SceneEditWireplugsSystem;
			wires_edit_system.setwire(wireplug, other_component);
		});
	}

	isInTileEditMode() {
		return (
			this.editmode == SceneEditToolMode.TILE_DRAW ||
			this.editmode == SceneEditToolMode.TILE_ERASE
		);
	}
}

export { SceneEditToolMode, SceneEditTools, SceneEditWireplugsSystem };
export default SceneEditTools;
