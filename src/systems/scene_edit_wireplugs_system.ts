import { Matters } from "../matters";
import MapSystem from "./map_system";
import {
	AssetContentTypeComponent,
	AssetContentTypeWireplug,
} from "../assets_base_extensions";
import { Assets } from "../assets";
import SceneRender from "../render/scene_render";
import { addEventListener } from "../document";
import * as THREE from "../lib/three.module";
import Events from "../events";

export class EditWireplugNode {
	root: THREE.Object3D;
	container: HTMLElement;
	events: Events;

	constructor() {
		this.events = new Events();
	}

	init(component: AssetContentTypeWireplug): THREE.Object3D {
		this.root = new THREE.Object3D();
		const size = 0.1;
		const color = 0xffffff;
		const geometry = new THREE.SphereGeometry(size);
		const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
		const sphere = new THREE.Mesh(geometry, material);
		sphere.renderOrder = 1;
		this.root.add(sphere);

		this.container = this.constructContainer(component);

		return this;
	}

	constructContainer(component: AssetContentTypeWireplug) {
		const container = this.container ?? document.createElement("el");
		container.innerHTML = "";
		container.classList.add(
			"flex-column",
			"buttons-list-s1",
			"position-absolute",
			"z-index-1",
			"frame-s1"
		);

		const newplug = document.createElement("btn");
		newplug.innerHTML = "connect";
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

		for(let i = component.get("guids") - 1; i >= 0; i--) {
			const id = "e_" + i;
			const k = component.get(id);
			if (k) {
				const e = document.createElement("entry");
				e.innerHTML = `${k}->`;
				container.appendChild(e);
			}
		}

		return container;
	}
}

export default class SceneEditWireplugsSystem extends MapSystem {
	events: Events;
	nodes: { [id: string]: EditWireplugNode };
	scene_render: SceneRender;
	matters: Matters;
	assets: Assets;

	constructor(scene_render: SceneRender, matters: Matters, assets: Assets) {
		super();

		this.events = new Events();
		this.priority = -1;
		this.scene_render = scene_render;
		this.matters = matters;
		this.assets = assets;
		this.nodes = {};
	}

	filter(
		component: AssetContentTypeWireplug,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "wireplug";
	}

	async add(
		component: AssetContentTypeWireplug,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}

		const owner_obj = this.scene_render.cache.objects[component.owner];
		const node = new EditWireplugNode();
		this.nodes[component.id] = node;

		node.init(component);
		owner_obj.add(node.root);
		node.events.on("dragstart", () => {
			this.events.emit("dragstart", component.id);
		});
		node.events.on("dragend", () => {
			this.events.emit("dragend", component.id);
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
		for(let i = from.get("guids") - 1; i >= 0; i--) {
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
}
