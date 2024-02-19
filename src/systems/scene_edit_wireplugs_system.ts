import { Matters } from "../matters";
import MapSystem from "./map_system";
import {
	AssetContentTypeComponent,
	AssetContentTypeWireplug,
} from "../assets_base_extensions";
import SceneRender from "../render/scene_render";
import { listenClick, addEventListener } from "../document";
import * as THREE from "../lib/three.module";
import Events from "../events";
import { PropertyInput } from "../page/property_input";
import { MapEvent, MapEventCode } from "./map_event";

export class EditWireplugNode {
	root: THREE.Object3D;
	sphere: THREE.Mesh;
	line_material: THREE.LineBasicMaterial;
	container: HTMLElement;
	events: Events;
	matters: Matters;
	scene_render: SceneRender;

	constructor(scene_render: SceneRender, matters: Matters) {
		this.events = new Events();
		this.matters = matters;
		this.scene_render = scene_render;
	}

	init(component: AssetContentTypeWireplug): THREE.Object3D {
		if (this.root) {
			this.root.removeFromParent();
		}
		this.root = new THREE.Object3D();
		const owner_obj = this.scene_render.cache.objects[component.owner];
		owner_obj.add(this.root);
		const size = 0.05;
		const color = 0xdddddd;
		const geometry = new THREE.SphereGeometry(size);
		const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
		const sphere = new THREE.Mesh(geometry, material);
		sphere.renderOrder = 1;
		this.root.add(sphere);
		this.sphere = sphere;

		const owner = this.matters.get(component.owner);
		const timer = this.matters.get(owner.get("timer"));
		if (false && timer) {
			const sprite = this.scene_render
				.makeSprite("timer_CW_75", this.root)
				.then((s) => {
					s.scale.multiplyScalar(0.1);
				});
		}

		this.container = this.constructFrame(component);
		this.constructLines(component);

		return this;
	}

	constructLines(component: AssetContentTypeWireplug) {
		const find_instance_source = (id) => {
			for (const k in this.matters.list) {
				const m = this.matters.list[k];
				if (m.inherites == id) {
					return m as AssetContentTypeComponent;
				}
			}

			return null;
		};

		const line_material = new THREE.LineBasicMaterial({
			color: 0xffffff,
			linewidth: 10,
			depthTest: false,
		});
		this.line_material = line_material;
		const make_line = (id: string, pos: THREE.Vector3) => {
			const vertices = [0, 0, 0, pos.x, pos.y, pos.z];
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(vertices, 3)
			);
			const line = new THREE.Line(geometry, line_material);
			line.renderOrder = 1;
			line.name = id;
			this.root.add(line);
		};

		const owner_obj = this.scene_render.cache.objects[component.owner];
		for (let i = component.get("guids") - 1; i >= 0; i--) {
			const id = "e_" + i;
			const k = component.get(id);
			if (k) {
				const instance = find_instance_source(k);
				if (!instance) {
					continue;
				}
				const object = this.scene_render.cache.objects[instance.id];
				if (!object) {
					continue;
				}
				const worldpos_a = owner_obj.getWorldPosition(
					this.scene_render.cache.vec3_0
				);
				const worldpos_b = object.getWorldPosition(
					this.scene_render.cache.vec3_1
				);
				const localpos = worldpos_b.sub(worldpos_a);
				make_line(k, localpos);
			}
		}
	}

	constructFrame(component: AssetContentTypeWireplug) {
		const container = this.container ?? document.createElement("el");
		container.innerHTML = "";
		container.id = "frame-edit-wireplug-" + component.owner;
		container.classList.add(
			"flex-column",
			"buttons-list-s1",
			"position-absolute",
			"z-index-1",
			"frame-s1",
			"wireplugs-edit-frame"
		);

		// -- plug btn
		const newplug = document.createElement("btn");
		newplug.classList.add("wireplug-connect-btn", "fittext", "img-plug");
		container.appendChild(newplug);

		addEventListener({
			callback: () => {
				this.events.emit("dragstart");
			},
			name: "mousedown",
			node: newplug,
		});
		addEventListener({
			callback: () => {
				this.events.emit("dragend");
			},
			name: "mouseup",
			node: newplug,
		});

		// current plugs btn
		for (let i = component.get("guids") - 1; i >= 0; i--) {
			const id = "e_" + i;
			const k = component.get(id);
			if (k) {
				const e = document.createElement("entry");
				e.classList.add("flex-row", "font-style-minor");
				e.innerHTML = `<t class="flex-grow-1">${k}-></t>`;
				container.appendChild(e);
				const delbtn = document.createElement("icon");
				delbtn.classList.add("img-delete", "fittext");
				e.appendChild(delbtn);

				listenClick(delbtn, async (ev: MouseEvent) => {
					const source = this.matters.get(component.inherites);
					delete source[id];
					this.init(component);
				});

				addEventListener({
					callback: () => {
						const line = this.root.getObjectByName(k);
						line.material.color.set(0x0000ff);
					},
					name: "mouseover",
					node: e,
				});
				addEventListener({
					callback: () => {
						const line = this.root.getObjectByName(k);
						line.material.color.set(0xffffff);
					},
					name: "mouseout",
					node: e,
				});
			}
		}

		// ---
		// property inputs
		const addSplitter = (name: string) => {
			const splitter = document.createElement("splitter");
			splitter.innerHTML = name;
			container.appendChild(splitter);
		};
		const addInput = (
			name: string,
			component: AssetContentTypeComponent,
			key: string = name
		) => {
			const input = new PropertyInput();
			const value = component.get(key);
			const input_el = input.init(value, (value) => {
				this.events.emit("propchange", { key, value, id: component.id });
			});
			input.draw(value);
			const text = document.createElement("t");
			text.innerHTML = name;
			input_el.insertBefore(text, input_el.firstChild);
			input_el.id = "input-edit-wireplug-" + key;
			container.appendChild(input_el);
		};

		addSplitter("wires");
		//addInput("filter", component);
		addInput("hold", component);
		addInput("release", component);

		const owner = this.matters.get(component.owner);
		const timer = this.matters.get(owner.get("timer"));
		if (timer) {
			//addSplitter("timer");
			//addInput("delay", timer as AssetContentTypeComponent);
		}

		return container;
	}
}

export default class SceneEditWireplugsSystem extends MapSystem {
	events: Events;
	nodes: { [id: string]: EditWireplugNode };
	scene_render: SceneRender;
	matters: Matters;

	constructor(scene_render: SceneRender, matters: Matters) {
		super();

		this.events = new Events();
		this.priority = -1;
		this.scene_render = scene_render;
		this.matters = matters;
		this.nodes = {};
	}

	filter(
		component: AssetContentTypeWireplug,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "wireplug";
	}

	add(
		component: AssetContentTypeWireplug,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}

		const node = new EditWireplugNode(this.scene_render, this.matters);
		this.nodes[component.id] = node;

		node.init(component);
		node.events.on("dragstart", () => {
			this.events.emit("dragstart", component.id);
		});
		node.events.on("dragend", () => {
			this.events.emit("dragend", component.id);
		});
		node.events.on("propchange", (opts) => {
			this.events.emit("propchange", opts);
		});

		this.scene_render.canvas_container.appendChild(node.container);
	}

	/**
	 * @param from {AssetContentTypeWireplug} wireplug component that has to be changed. Components added into system by instance but instance source has to be used here
	 * @param to {AssetContentTypeComponent} component that has to be linked. Also source has to be used
	 */
	async setwire(from: AssetContentTypeWireplug, to: AssetContentTypeComponent) {
		// ignore links to self
		if (from.owner == to.id) {
			return;
		}

		// igronre link dupes
		for (let i = from.get("guids") - 1; i >= 0; i--) {
			const k = from.get("e_" + i);
			if (k && k == to.id) {
				return;
			}
		}

		const plug_index = from.get("guids") ?? 0;
		from.set("guids", plug_index + 1);
		from.set("e_" + plug_index, to.id);
	}

	remove(component: AssetContentTypeComponent) {
		const node = this.nodes[component.id];
		if (!node) {
			return;
		}

		node.root.removeFromParent();
		node.container.parentElement.removeChild(node.container);
		delete this.nodes[component.id];
	}

	step(dt: number) {
		for (const k in this.nodes) {
			const node = this.nodes[k];
			const width = this.scene_render.getRenderWidth();
			const height = this.scene_render.getRenderHeight();
			const half_width = width / 2;
			const half_height = height / 2;

			const pos = this.scene_render.cache.vec3_0.setFromMatrixPosition(
				node.root.matrixWorld
			);
			pos.project(this.scene_render.camera);
			pos.x = pos.x * half_width + half_width;
			pos.y = -pos.y * half_height + half_height;
			node.container.style.top = pos.y + "px";
			node.container.style.left = pos.x + "px";
		}
	}

	event(event: MapEvent) {
		if (event.tag !== "self-activation") {
			return;
		}

		const component = this.matters.get(event.component);
		const wireplug = this.matters.get(component?.get("wireplug"));
		const node = this.nodes[wireplug?.id];
		if (!node) {
			return;
		}

		const color = event.code == MapEventCode.START ? 0x00ff00 : 0xdddddd;
		node.sphere.material.color.set(color);
		node.line_material.color.set(color);
	}
}
