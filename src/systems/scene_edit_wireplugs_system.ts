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
		const container = document.createElement("el");
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

	async setwire(from: AssetContentTypeWireplug, to: AssetContentTypeComponent) {
		if (from.owner == to.id) {
			return;
		}

		console.log(from, to);

		/*
		const wireplug_instance = this.matters.get(
			from
		) as AssetContentTypeComponent;
		const wireplug = this.matters.get(
			wireplug_instance.inherites
		) as AssetContentTypeComponent;

		const otherplug_instance = this.matters.get(to);
		const otherplug = this.matters.get(otherplug_instance.inherites);
		console.log(wireplug_instance, otherplug_instance);

		const local_id = omatter.get("guids") ?? 0;
		omatter.set("guids", local_id + 1);
	 */
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
