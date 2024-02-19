import { AssetContentTypeTile } from "../assets";
import { querySelector } from "../document";
import MapSystem from "./map_system";
import {
	AssetContentTypeComponent,
	AssetContentTypeTileset,
	AssetContentTypeTexture,
} from "../assets";
import { Matters } from "../matters";

class MapTileset {
	tilerefs: { [id: number]: string };
	components: { [id: string]: string };
	colors: { [id: string]: string };
	image: HTMLImageElement | null;
	tileset: AssetContentTypeTileset;
	canvas: HTMLCanvasElement;

	matters: Matters;

	constructor(matters: Matters, tileset: AssetContentTypeTileset) {
		this.matters = matters;

		this.tileset = tileset;
		this.components = {};
		this.tilerefs = {};
		this.colors = {};
		this.image = null;

		this.init();
	}

	private init() {
		const tileset = this.tileset;
		const id = this.tileset.id;
		this.canvas = querySelector(
			"db#cache canvas#cache_canvas"
		) as HTMLCanvasElement;

		const img = (this.matters.get(tileset.texture) as AssetContentTypeTexture)
			.asset as HTMLImageElement;
		this.image = img;

		// generate tileset list
		for (const k in tileset) {
			if (!k.startsWith("tile_")) {
				continue;
			}
			const tile = this.matters.get(tileset[k]) as AssetContentTypeTile;
			let color = tile.color;

			if (!color) {
				console.warn(
					`SceneRender::addTileset error - no color set. color: (${color})`
				);
				continue;
			}

			if (!color.includes("#")) {
				throw new Error(
					`SceneRender::addTileset error - wrong color "${color}" format. It should start with "#"`
				);
			}
			if (color.length != "#00000000".length) {
				color += "ff";
			}
			if (color.length != "#00000000".length) {
				throw new Error(
					`SceneRender::addTileset error - wrong color "${color}" length. It should be like "#000000" (RGB) or "#00000000" (RGBA)`
				);
			}

			const refid = tile.link;
			const colorid = parseInt(color.replace("#", "0x"));
			this.components[refid] = refid;
			this.tilerefs[colorid] = refid;
			this.colors[refid] = color;
		}
	}

	propagate(
		ontile: (ref_id: string, id: string, pos_x: number, pos_y: number) => void,
		min_x?: number | null,
		min_y?: number | null,
		max_x?: number | null,
		max_y?: number | null
	) {
		if (!this.image || !this.tileset) {
			console.error("MapTileset::propagate error - tileset wasn't initialised");
			return;
		}

		const tileset = this.tileset;

		const img = this.image;
		const canvas = this.canvas;

		const origin_x = tileset.pos_x ?? 0;
		const origin_y = tileset.pos_y ?? 0;

		const omin_x = Math.round(origin_x);
		const omax_y = Math.round(origin_y);
		const omin_y = omax_y - img.height; // y operations inverted
		const omax_x = omin_x + img.width;

		min_x = Math.round(min_x ?? omin_x);
		min_y = Math.round(min_y ?? omin_y);
		max_x = Math.round(max_x ?? omax_x);
		max_y = Math.round(max_y ?? omax_y);
		const max_w = max_x - min_x;
		const max_h = max_y - min_y;

		const d1x = omax_x - min_x;
		const d1y = omax_y - min_y;
		const d2x = max_x - omin_x;
		const d2y = max_y - omin_y;

		if (d1x < 0.0 || d1y < 0.0) return false;

		if (d2x < 0.0 || d2y < 0.0) return false;

		const clip_x = Math.max(omin_x, min_x) - omin_x;
		const clip_y = omax_y - Math.min(omax_y, max_y);
		const clip_w = Math.min(max_w, d1x, d2x, img.width);
		const clip_h = Math.min(max_h, d1y, d2y, img.height);

		if (clip_x < 0 || clip_y < 0 || clip_w <= 0 || clip_h <= 0) {
			return;
		}

		canvas.width = clip_w;
		canvas.height = clip_h;
		const ctx = canvas.getContext("2d"); // , { willReadFrequently: true } // has to be callen at first getContext
		ctx?.clearRect(0, 0, canvas.width, canvas.height);
		ctx?.drawImage(img, clip_x, clip_y, clip_w, clip_h, 0, 0, clip_w, clip_h);
		const imgdata = ctx?.getImageData(0, 0, clip_w, clip_h).data;

		if (!imgdata) {
			throw new Error("SceneRender::addTileset error - no image data");
		}

		// parse image tileset
		const unused_colors: Array<number> = [];
		for (let i = 0; i < imgdata.length && this.tileset; i += 4) {
			const r = imgdata[i] & 0xff;
			const g = imgdata[i + 1] & 0xff;
			const b = imgdata[i + 2] & 0xff;
			const a = imgdata[i + 3] & 0xff;
			const color = ((r << 24) >>> 0) + (g << 16) + (b << 8) + (a << 0);

			const cache_id = this.tilerefs[color];
			if (!cache_id) {
				if (
					parseInt(tileset.zero_color.replace("#", "0x")) != color &&
					unused_colors.indexOf(color) < 0
				) {
					unused_colors.push(color);
				}
				continue;
			}

			// add meshes
			const ox = clip_x;
			const oy = -clip_y;
			const lx = ((i / 4) % canvas.width) * tileset.tilesize_x;
			const ly = -Math.floor(i / 4 / canvas.width) * tileset.tilesize_y;
			const pos_x = ox + lx;
			const pos_y = oy + ly;
			const tileid = this.makeTileId(pos_x, pos_y);

			ontile(cache_id, tileid, origin_x + pos_x, origin_y + pos_y);
		}

		for (const i in unused_colors) {
			console.warn(
				`SceneRender::addTileset ref texture has color #${unused_colors[i]
					.toString(16)
					.padStart(8, "0")} which does not have tile for that.`
			);
		}
	}

	makeTileId(pos_x: number, pos_y: number): string {
		return `${this.tileset.id}-tile-x${pos_x}_y${pos_y}`;
	}

	get pos_x() {
		return this.tileset.pos_x ?? 0;
	}

	get pos_y() {
		return this.tileset.pos_y ?? 0;
	}
}

class MapTilesetSystem extends MapSystem {
	tilesets: { [id: string]: MapTileset };
	matters: Matters;

	constructor(matters: Matters) {
		super();
		this.priority = 0;
		this.matters = matters;
		this.tilesets = {};
	}

	filter(component: AssetContentTypeTileset): boolean {
		return component.type == "tileset";
	}

	add(component: AssetContentTypeTileset, owner?: AssetContentTypeComponent) {
		if (!this.filter(component)) {
			return;
		}

		const tileset = new MapTileset(this.matters, component);
		//tileset.propagate((ref_id, id, pos_x, pos_y) => {console.log(ref_id, id, pos_x, pos_y)});
		this.tilesets[component.id] = tileset;
	}

	remove(component: AssetContentTypeTileset) {
		delete this.tilesets[component.id];
	}
}

export default MapTileset;
export { MapTileset, MapTilesetSystem };
