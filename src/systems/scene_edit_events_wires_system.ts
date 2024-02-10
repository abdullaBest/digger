import { Matters } from "../matters";
import MapSystem from "./map_system";
import {
	AssetContentTypeComponent,
	AssetContentTypeEvents,
} from "../assets.js";
import SceneRender from "../render/scene_render.js";
import * as THREE from "../lib/three.module.js";

export class EditEventWiresNode {
	root: THREE.Object3D;
	container: HTMLElement;

	init(component: AssetContentTypeEvents): THREE.Object3D {
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

	constructContainer(component: AssetContentTypeEvents) {
		const container = document.createElement("el");
		container.classList.add("position-absolute", "z-index-1", "frame-s1");
		container.innerHTML = "aaa";

		console.log(component);

		return container;
	}
}

export default class SceneEditEventWiresSystem extends MapSystem {
	nodes: { [id: string]: EditEventWiresNode };
	scene_render: SceneRender;
	matters: Matters;
	constructor(scene_render: SceneRender, matters: Matters) {
		super();

		this.priority = -1;
		this.scene_render = scene_render;
		this.matters = matters;
		this.nodes = {};
	}

	filter(
		component: AssetContentTypeEvents,
		owner?: AssetContentTypeComponent
	): boolean {
		return component.type === "events";
	}

	async add(
		component: AssetContentTypeEvents,
		owner?: AssetContentTypeComponent | null
	) {
		if (!this.filter(component)) {
			return;
		}

		const owner_obj = this.scene_render.cache.objects[component.owner];
		const node = new EditEventWiresNode();
		this.nodes[component.id] = node;

		node.init(component);
		owner_obj.add(node.root);

		this.scene_render.canvas_container.appendChild(node.container);
	}
	remove(component: AssetContentTypeComponent) {
		const node = this.nodes[component.id];
		if (!node) {
			return;
		}

		node.root.removeFromParent();
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
