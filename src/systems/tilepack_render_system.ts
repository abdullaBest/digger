import * as THREE from "../lib/three.module.js";
import SceneRender from "../render/scene_render";
import SceneCore from "../app/scene_core";

import { MapSystem } from ".";
import { AssetContentTypeComponent, AssetContentTypeModel } from "../app/assets";
import { sprintf } from "../lib/sprintf.js";
import logger from "../core/logger";

/**
 * This system renders tilepack components wich holds batch of tile mesh pieces
 */
export default class TilepackRenderSystem extends MapSystem {
	private scene_render: SceneRender;
	private scene_core: SceneCore;
	private tiles: { [id: string] : AssetContentTypeComponent };

	constructor(scene_render: SceneRender, scene_core: SceneCore) {
		super();
		this.priority = 0;
		this.scene_render = scene_render;
		this.tiles = {};
	}

	filter(component: AssetContentTypeModel): boolean {
		return component.type == "model_tilepack";
	}

	async load(component: AssetContentTypeModel) {
		if (!this.filter(component)) {
			return;
		}

		await this.scene_render.loader.loadModel(component);
	}

	add(
		component: AssetContentTypeModel,
		owner?: AssetContentTypeComponent
	) {
		if (!this.filter(component)) {
			return;
		}

		const comp = component as any;
		const x = comp.tile_x ?? 0;
		const y = comp.tile_y ?? 0;

		this.tiles[this.getTileId(comp.tileset, x, y)] = component;

		this.updateSurroundings(comp.tileset, x, y);
	}
	
	getTileId(tileset: string, x: number, y: number) {
		return `${tileset}-x${x}-y${y}`; 
	}

	updateSurroundings(tileset: string, x: number, y: number) {
		for(let iy = -1; iy <= 1; iy++) {
			for(let ix = -1; ix <= 1; ix++) {
				this.update(tileset, x + ix, y + iy);
			}
		}
	}

	update(tileset: string, x: number, y: number) {
		const component = this.tiles[this.getTileId(tileset, x, y)] as any;
		if (!component) {
			return;
		}
		const center_filter = component.model_center_filter;
		const x_side = (Math.abs(Math.round(x)) % 4) + 1;
		const y_side = (Math.abs(Math.round(y)) % 4) + 1;

		let filter = sprintf(center_filter, y_side, x_side);

		const s_tl = this.tiles[this.getTileId(tileset, x - 1, y + 1)];
		const s_t = this.tiles[this.getTileId(tileset, x, y + 1)];
		const s_tr = this.tiles[this.getTileId(tileset, x + 1, y + 1)];
		const s_bl = this.tiles[this.getTileId(tileset, x - 1, y - 1)];
		const s_b = this.tiles[this.getTileId(tileset, x, y - 1)];
		const s_br = this.tiles[this.getTileId(tileset, x + 1, y - 1)];
		const s_l = this.tiles[this.getTileId(tileset, x - 1, y)];
		const s_r = this.tiles[this.getTileId(tileset, x + 1, y)];

		// top-left corner
		if (!s_tl && !s_t && !s_l) {
			filter += sprintf("," + component.model_corner_out_filter, 1);
		} else if (!s_t && s_tl) {
			filter += sprintf("," + component.model_corner_in_filter, 3);
		} else if (!s_t) {
			filter += sprintf("," + component.model_top_filter, 1);
		}

		// top-right corner
		if (!s_tr && !s_t && !s_r) {
			filter += sprintf("," + component.model_corner_out_filter, 2);
		} else if (!s_t && s_tr) {
			filter += sprintf("," + component.model_corner_in_filter, 4);
		} else if (!s_t) {
			filter += sprintf("," + component.model_top_filter, 2);
		}

		// bottom-left corner
		if (!s_bl && !s_b && !s_l) {
			filter += sprintf("," + component.model_corner_out_filter, 3);
		} else if (!s_b && s_bl) {
			filter += sprintf("," + component.model_corner_in_filter, 1);
		} else if (!s_b) {
			filter += sprintf("," + component.model_bottom_filter, 1);
		}

		// bottom-right
		if (!s_br && !s_b && !s_r) {
			filter += sprintf("," + component.model_corner_out_filter, 4);
		} else if (!s_b && s_br) {
			filter += sprintf("," + component.model_corner_in_filter, 2);
		} else if (!s_b) {
			filter += sprintf("," + component.model_bottom_filter, 2);
		}

		// left
		if (s_t && !s_tl && !s_l) {
			filter += sprintf("," + component.model_left_filter, 1);
		}
		if (s_b && !s_bl && !s_l) {
			filter += sprintf("," + component.model_left_filter, 2);
		}
		// right
		if (s_t && !s_tr && !s_r) {
			filter += sprintf("," + component.model_right_filter, 1);
		}
		if (s_b && !s_br && !s_r) {
			filter += sprintf("," + component.model_right_filter, 2);
		}

		if (!s_t && Math.random() > 0.5) {
			const num = Math.floor(Math.random() * 3) + 1;
			filter += sprintf("," + component.model_decor_top_filter, num);
		}

		if (component.filter === filter) {
			console.log(component.filter, filter);
			return;
		}

		component.filter = filter;

		this.scene_render.removeObject(component.id);

		try {
			const obj = this.scene_render.addModel(
				component.id,
				component
			);
		} catch (err) {
			logger.error(err);
			component.filter = null;
			const obj = this.scene_render.addModel(
				component.id,
				component
			);
		}
	}

	remove(component: AssetContentTypeModel) {
		if (!this.filter(component)) {
			return;
		}
		this.scene_render.removeObject(component.id);

		const comp = component as any;
		const x = comp.tile_x ?? 0;
		const y = comp.tile_y ?? 0;

		delete this.tiles[this.getTileId(comp.tileset, x, y)];
		this.updateSurroundings(comp.tileset, x, y);
	}
}
