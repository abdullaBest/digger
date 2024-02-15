import AssetsLibraryView from "./assets_library_view";
import {
	querySelector,
	listenClick,
	addEventListener,
	EventListenerDetails,
} from "../document";
import {
	Assets,
	Asset,
	AssetContentTypeComponent,
	AssetContentTypeTileset,
	AssetContentTypeTexture,
	sendFiles,
} from "../assets";
import { SceneEditTools, SceneEditToolMode } from "../render/scene_edit_tools";
import SceneCore from "../scene_core";
import { uploadThumbnail } from "../importer";
import { MapTilesetSystem } from "../systems";

export default class SceneEditView {
	asset_selected: Asset;
	assets_library_view: AssetsLibraryView;
	scene_edit_tools: SceneEditTools;
	scene_core: SceneCore;
	assets: Assets;
	container_lib: HTMLElement;
	container_list: HTMLElement;
	private _listeners: Array<EventListenerDetails>;

	constructor(
		assets_library_view: AssetsLibraryView,
		scene_core: SceneCore,
		scene_edit_tools: SceneEditTools
	) {
		this.assets_library_view = assets_library_view;
		this.assets = this.assets_library_view.assets;
		this.scene_edit_tools = scene_edit_tools;
		this.scene_core = scene_core;
		this._listeners = [];
	}

	init() {
		const lib_container = querySelector("#edit-assets-section");
		this.container_lib = querySelector("content", lib_container);
		this.container_list = querySelector("#scene-content-list");

		for (const k in this.assets_library_view.assets.list) {
			this.listAssetLib(k);
		}
		this.assets.events.on(
			"asset",
			({ id }) => {
				this.listAssetLib(id);
			},
			this._listeners
		);

		// asset library click
		listenClick(
			this.container_lib,
			(ev) => {
				this.saveAsset(this.asset_selected?.id);
				const id = (ev.target as HTMLElement)?.id;
				const matter = this.assets.matters.list[id];
				if (matter) {
					this.viewAsset(id);
				}
			},
			this._listeners
		);

		// scene elements click
		listenClick(
			this.container_list,
			(ev) => {
				const id = (ev.target as HTMLElement)?.id;
				const matter = this.assets.matters.list[id];
				if (!matter) {
					return;
				}

				let instance = matter as AssetContentTypeComponent;
				for (const k in this.scene_core.components) {
					const c = this.scene_core.components[k];
					if (c.inherites == matter.id) {
						instance = c;
						break;
					}
				}

				this.scene_edit_tools.tileset_editor.cleanupPalette();
				this.scene_edit_tools.attachTransformControls(instance.id);
				if (instance.type == "tileset") {
					this.scene_edit_tools.tileset_editor.drawPalette(
						(this.scene_core.systems.tileset as MapTilesetSystem).tilesets[
							instance.id
						]
					);
				}
			},
			this._listeners
		);

		listenClick(
			"#edit-controls-save-asset",
			() => this.saveAsset(this.asset_selected.id),
			this._listeners
		);
		listenClick(
			"#edit-controls-make-thumbnail",
			() => uploadThumbnail(this.asset_selected, this.scene_core.scene_render),
			this._listeners
		);

		this.initDragzone();
		this.initTransformControls();
	}

	initDragzone() {
		const scene_content = this.container_list;
		addEventListener(
			{
				name: "drop",
				callback: async (ev) => {
					if (!scene_content.classList.contains("dropallow")) {
						return;
					}
					let id = "";
					const datatransfer = (ev as DragEvent).dataTransfer;
					if (datatransfer) {
						id = datatransfer.getData("text/plain");
					}
					if (this.asset_selected) {
						this.addComponent(this.asset_selected.id, id);
					}
				},
				node: scene_content,
			},
			this._listeners
		);

		addEventListener(
			{
				name: "dragenter",
				callback: async (ev) => {
					if (scene_content.classList.contains("dropallow")) {
						ev.preventDefault();
					}
				},
				node: scene_content,
			},
			this._listeners
		);
		addEventListener(
			{
				name: "dragover",
				callback: async (ev) => {
					if (scene_content.classList.contains("dropallow")) {
						ev.preventDefault();
					}
				},
				node: scene_content,
			},
			this._listeners
		);
		addEventListener(
			{
				name: "dragleave",
				callback: async (ev) => {
					if (scene_content.classList.contains("dropallow")) {
						ev.preventDefault();
					}
				},
				node: scene_content,
			},
			this._listeners
		);
	}

	initTransformControls() {
		const set_edit_mode = (mode: SceneEditToolMode) => {
			this.scene_edit_tools.setEditMode(mode);
			switch (mode) {
				case SceneEditToolMode.DEFAULT:
					break;
				case SceneEditToolMode.TRANSLATE:
					break;
				case SceneEditToolMode.ROTATE:
					break;
				case SceneEditToolMode.SCALE:
					break;
				case SceneEditToolMode.TILE_DRAW:
					break;
				case SceneEditToolMode.TILE_ERASE:
					break;
			}
		};

		const edit_modes_elements = {
			[SceneEditToolMode.TRANSLATE]: querySelector(
				"#controls_mode_transform_translate"
			),
			[SceneEditToolMode.ROTATE]: querySelector(
				"#controls_mode_transform_rotate"
			),
			[SceneEditToolMode.SCALE]: querySelector(
				"#controls_mode_transform_scale"
			),
			[SceneEditToolMode.TILE_DRAW]: querySelector("#controls_mode_draw_tiles"),
			[SceneEditToolMode.TILE_ERASE]: querySelector(
				"#controls_mode_erase_tiles"
			),
			[SceneEditToolMode.WIRES]: querySelector("#controls_mode_edit_wires"),
		};

		const addModeBtnListener = (mode: SceneEditToolMode) => {
			const el = edit_modes_elements[mode];
			listenClick(
				el,
				() => {
					set_edit_mode(mode);
					for (const i in edit_modes_elements) {
						edit_modes_elements[i].classList.remove("highlighted");
					}
					el.classList.add("highlighted");
				},
				this._listeners
			);
		};

		addModeBtnListener(SceneEditToolMode.TRANSLATE);
		addModeBtnListener(SceneEditToolMode.ROTATE);
		addModeBtnListener(SceneEditToolMode.SCALE);
		addModeBtnListener(SceneEditToolMode.TILE_DRAW);
		addModeBtnListener(SceneEditToolMode.TILE_ERASE);
		addModeBtnListener(SceneEditToolMode.WIRES);
		// toggles modes of transform helper
		const tcontrols = this.scene_edit_tools.transform_controls;

		listenClick(
			"#controls_mode_transform_toggle_snap",
			(ev) => {
				let tsnap: number | null = 1;
				let rsnap: number | null = (15 * Math.PI) / 180;
				let ssnap: number | null = 0.25;
				if (!(ev.target as HTMLElement)?.classList.toggle("highlighted")) {
					tsnap = rsnap = ssnap = null;
				}
				tcontrols.setTranslationSnap(tsnap);
				tcontrols.setRotationSnap(rsnap);
				tcontrols.setScaleSnap(ssnap);
			},
			this._listeners
		);
		listenClick(
			"#controls_mode_transform_toggle_world",
			(ev) => {
				const mode_local = (ev.target as HTMLElement)?.classList.toggle(
					"highlighted"
				);
				const mode_text = mode_local ? "local" : "world";
				tcontrols.setSpace(mode_text);
				//(ev.target as HTMLElement).innerHTML = "t: " + mode_text;
			},
			this._listeners
		);

		tcontrols.addEventListener("objectChange", (e) => {
			const object = e.target.object;
			const id = object.name;
			const instance = this.assets.matters.get(id);
			const matter = (
				instance.inherites
					? this.assets.matters.get(instance.inherites)
					: instance
			) as AssetContentTypeComponent;

			// only works with scene edit elements
			if (!matter) {
				return;
			}

			const pos_x = (object as any).position.x;
			const pos_y = (object as any).position.y;
			matter.pos_x = pos_x;
			matter.pos_y = pos_y;
			matter.matrix = object.matrixWorld.toArray();
		});

		tcontrols.addEventListener("object-changed", (e) => {
			const object = e.target.object;
			if (!object) {
				return;
			}
			const id = object.name;
			const matter = this.assets.matters.get(id);
			if (id) {
				console.log("selected component " + id, matter);
			}
		});

		tcontrols.addEventListener("mouseUp", async (e) => {
			const object = e.target.object;
			const id = object.name;
			const instance = this.assets.matters.get(id);

			// all transfroms attached to component instance initially
			// changes has to be made in original component
			const matter = instance.inherites
				? this.assets.matters.get(instance.inherites)
				: instance;
			if (!matter) {
				return;
			}

			// redraw tileset
			if (matter.get("type") === "tileset") {
				//this.redrawElement(matter.id);
			}

			// remake component after each change
			this.scene_core.remove(instance.id);
			const ninstance = await this.scene_core.add(
				matter as AssetContentTypeComponent
			);
			if (ninstance) {
				tcontrols.attach(
					this.scene_core.scene_render.cache.objects[ninstance.id]
				);
			}
		});
	}

	saveAsset(id: string) {
		if (!id) {
			return;
		}
		this.assets_library_view.saveAsset(id);
		this.scene_core.matters.traverse(id, null, (m) => {
			if (m.inherited_equals("type", "tileset")) {
				this.saveAssetTileset(m.id);
			}
		});
	}

	/**
	 * saves new tileset image
	 *
	 * @param id tileset id
	 */
	saveAssetTileset(id: string) {
		const tileset = this.scene_core.matters.get(id) as AssetContentTypeTileset;
		const image_matter = this.scene_core.matters.get(
			tileset.texture
		) as AssetContentTypeTexture;
		const image_asset = this.assets.get(image_matter.id);
		const image = image_matter.asset;
		if (!image) {
			return;
		}

		// is it possible to send files without canvas?
		const canvas = querySelector(
			"db#cache canvas#cache_canvas"
		) as HTMLCanvasElement;
		const ctx = canvas.getContext("2d");
		if (!canvas || !image || !ctx) {
			return;
		}

		canvas.width = image.width;
		canvas.height = image.height;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(image, 0, 0);
		canvas.toBlob(async (blob) => {
			if (!blob || !image_asset) {
				return;
			}
			const file = new File([blob], image_asset.info.id, {
				type: image_asset.info.type,
			});

			await this.assets.uploadAsset(image_asset.id, [file]);
		});
	}

	viewAsset(id: string) {
		const sidebar = querySelector("#edit-sidebar");
		sidebar.classList.remove("noselected");
		const header = querySelector("#scene-content-list-header");
		const asset = this.assets.get(id);
		this.asset_selected = asset;
		const matter = this.assets.matters.list[id];
		header.innerHTML = matter.name;

		this.container_list.innerHTML = "";
		for (const k in matter) {
			if (!matter.is_link(k)) {
				continue;
			}

			const val = matter.get(k);
			const _m = this.assets.matters.get(val);
			const entry = this.assets_library_view.listAsset(
				_m.id,
				this.container_list
			);
		}

		this.assets_library_view.renderAsset(id);
	}

	async addComponent(owner: string, inherites: string) {
		const omatter = this.assets.matters.get(owner);

		if (owner == inherites) {
			return;
		}

		const inherite = this.assets.matters.get(inherites);
		const extension = inherite.get("type");
		const global_id = await this.assets.uploadComponent(
			{ inherites, owner: owner, name: "c-" + inherite.name },
			extension
		);

		// scene has to be cleaned up before link set
		this.scene_core.cleanup();

		const local_id = omatter.get("guids") ?? 0;
		omatter.set("guids", local_id + 1);
		omatter.set_link("e" + local_id, global_id);

		this.viewAsset(owner);
	}

	listAssetLib(id: string) {
		const entry = this.assets_library_view.listAsset(id, this.container_lib);
		const matter = this.assets.matters.list[id];
		if (!matter?.inherited_equals("type", "component")) {
			entry.classList.add("disabled-optional");
		}

		if (!entry.querySelector(".img-external")) {
			const icon = document.createElement("icon");
			icon.classList.add("img-external", "fittext");
			entry.insertBefore(icon, entry.firstChild);
		}

		entry.draggable = true;
		addEventListener(
			{
				name: "dragstart",
				callback: async (ev) => {
					const datatransfer = (ev as DragEvent).dataTransfer;
					const id = entry.id;
					if (!id || !this.asset_selected) {
						return;
					}

					const selected_matter = this.assets.matters.get(
						this.asset_selected.id
					);
					if (!selected_matter.inherited_equals("type", "space")) {
						return;
					}

					if (datatransfer) {
						datatransfer.setData("text/plain", id);
						//datatransfer.setDragImage(querySelector(".img-thumbnail", entry), 64, 64);
					}
					entry.classList.add("dragged");
					this.container_list.classList.add("dropallow");
				},
				node: entry,
			},
			this._listeners
		);
		addEventListener(
			{
				name: "dragend",
				callback: async (ev) => {
					entry.classList.remove("dragged");
					this.container_list.classList.remove("dropallow");
				},
				node: entry,
			},
			this._listeners
		);
	}
}
