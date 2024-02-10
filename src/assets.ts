import { Matters, Matter } from "./matters";
import Events from "./events";
import { sendFiles, listenFormSubmit } from "./request_utils";
import {
	BaseContentExtensionsList,
	cunstructBaseExtensionsData,
} from "./assets_base_extensions";

enum AssetStatus {
	UNKNOWN = 0,
	ERROR = 1,
	LOADING = 2,
	LOADED = 3,
}

interface AssetInfo {
	url: string;
	name: string;
	tags: string;
	id: string;
	type: string;
	extension: string;
	revision: number;
}

class Asset {
	status: AssetStatus;
	info: AssetInfo;
	content: any;
	id: string;

	/**
	 * Some assets (configs) may be bundled in one file. This value stores bundle id
	 * not implemented for now
	 */
	bundle: string | null;

	private _thumbnail: string | null;

	constructor(options: AssetInfo, id: string, bundle: string | null = null) {
		this.status = AssetStatus.UNKNOWN;
		this.info = options;
		this._thumbnail = null;
		this.id = id;
		this.bundle = bundle;
	}

	/**
	 * Loads asset content
	 */
	async load() {
		this.status = AssetStatus.LOADING;
		const path = this.info.url;
		const id = this.info.id;

		const res = await fetch(path);
		if (!res.ok) {
			console.error(`asset ${id} loading error`, res);
			throw new Error(`asset ${id} loading error`);
		}

		if (this.info.type.includes("json")) {
			this.content = await res.json();
		} else if (this.info.type.includes("image")) {
			const cache = document.querySelector("db#cache");
			const elid = "#asset_img-" + id;
			const img = (cache?.querySelector(elid) ??
				document.createElement("img")) as HTMLImageElement;
			if (!img.parentElement) {
				cache?.appendChild(img);
				img.id = elid;
				img.src = path;
			}

			this.content = {
				asset: img,
				url: this.info.url,
			};
		}

		if (this.info.extension == "gltf") {
			this.content = this.content || {};
			this.content.url = this.info.url;
		}

		this.status = AssetStatus.LOADED;
	}

	get thumbnail(): string {
		if (this._thumbnail) {
			return this._thumbnail;
		}

		let url = "";
		if (this.info.type.includes("image")) {
			url = this.info.url;
		} else {
			url = "/assets/load/thumbnail/" + this.id;
		}

		this._thumbnail = url;

		return this._thumbnail;
	}
}

class Assets {
	status: AssetStatus;
	loadprogress: number;
	list: { [id: string]: Asset };

	// Asset wich stores all components
	bundles: { [id: string]: Asset };

	matters: Matters;
	events: Events;

	private _base_content_extensions: BaseContentExtensionsList;

	constructor() {
		this.events = new Events();
		this.matters = new Matters();
		this.status = AssetStatus.UNKNOWN;
		this.loadprogress = 0;
	}

	init() {
		this.matters.init();

		this._base_content_extensions = cunstructBaseExtensionsData(this.matters);
	}

	get(id: string): Asset {
		const asset = this.list[id] ?? null;

		if (!asset) {
			throw new Error("Assets: can't find asset " + id);
		}

		return asset;
	}

	/**
	 * @param filter regexp match or strict match
	 * @returns
	 */
	find(filter: { [id: string]: string | RegExp }): { [id: string]: Asset } {
		const assets = {};
		for (const id in this.list) {
			if (this.filter(id, filter)) {
				assets[id] = this.get(id);
			}
		}

		return assets;
	}

	/**
	 *
	 * @param id asset id
	 * @param filter regexp match or strict string match
	 * @returns true if asset matches all filters
	 */
	filter(id: string, filter: { [id: string]: string | RegExp }): boolean {
		const asset = this.get(id);

		let filtered = false;
		for (const k in filter) {
			if (!(k in asset.info)) {
				continue;
			}
			const regexp_check =
				typeof asset.info[k] == "string" && typeof filter[k] == "object";
			if (
				(regexp_check && !asset.info[k].match(filter[k])) ||
				(!regexp_check && asset.info[k] != filter[k])
			) {
				filtered = true;
				break;
			}
		}

		return !filtered;
	}

	/**
	 * Loads asset metadata + asset content if it json type
	 * @param onprogress callbacks on asset loaded
	 */
	async loadAsset(id: string) {
		const path = "/assets/get/" + id;
		const res = await fetch(path);
		if (!res.ok) {
			console.error(`asset ${id} loading error`, res);
			throw new Error(`asset ${id} loading error`);
		}
		const data = await res.json();
		//const myContentType = res.headers.get("Content-Type");

		const asset = this._createAsset(data);
		await asset.load();
		this._initAsset(asset, asset.content);
	}

	_createAsset(info: AssetInfo): Asset {
		const _info = {
			url: info.url,
			name: info.name,
			id: info.id,
			type: info.type,
			extension: info.extension,
			revision: info.revision,
			tags: info.tags ?? "",
		} as AssetInfo;

		const asset = new Asset(_info, _info.id);
		this.list[_info.id] = asset;

		return asset;
	}

	_initAsset(asset: Asset, content?: any | null): Matter {
		if (content) {
			this.parseAssetContent(asset, content);
		}
		this.events.emit("asset", { id: asset.id });

		return asset.content;
	}

	/**
	 * Uber function that handles all asset types
	 *
	 * @param asset
	 * @returns
	 */
	private parseAssetContent(asset: Asset, content?: any | null) {
		// A. bundle
		if (asset.info.extension == "bundle") {
			const name = asset.info.name.split(".").shift() ?? asset.info.name;
			for (const k in content.list) {
				const c = content.list[k];
				const id = c.id ?? k;
				//const name = c.name ?? `${asset.info.name}-${id}`;
				const _asset = this._createAsset(content.infos[id]);
				_asset.bundle = name;
				content.list[k] = this._initAsset(_asset, c);
			}

			this.bundles[name] = asset;

			return;
		}

		// B. Single asset content
		// a. replacing existing matter (any kind of reloading)
		if (this.matters.get(asset.id)) {
			asset.content = this.matters.replace(content, asset.id);
			return;
		}

		// b. creating new matter
		const inherites =
			content.inherites ??
			this._base_content_extensions[asset.info.extension]?.id;
		try {
			asset.content = this.matters.create(
				content,
				inherites,
				asset.id,
				asset.info.name
			);
		} catch (err) {
			console.error(`Asset ${asset.id} creating error:`, err);
		}
	}

	/**
	 *
	 * @param onprogress callbacks on asset loaded
	 */
	async load() {
		this.status = AssetStatus.LOADING;
		const res = await fetch("/assets/list");
		if (!res.ok) {
			console.error("Assets loading error", res);
			throw new Error("Assets loading error");
		}
		this.list = {};
		this.bundles = {};
		const data = await res.json();
		const values = Object.values(data);
		const toload = values.length - 1;
		let loaded = 0;
		for (const i in data) {
			try {
				await this.loadAsset(data[i]);
				this.loadprogress = ++loaded / toload;
			} catch (err) {
				console.error(`Asset ${data[i]} loading error:`, err);
				this.status = AssetStatus.ERROR;
			}
		}
		this.status = AssetStatus.LOADED;
		this.events.emit("loaded");
	}

	async uploadAsset(id: string, files?: Array<File>, custom?: any) {
		const res = await sendFiles(`/assets/upload/${id}`, files, custom);
		await this.loadAsset(id);
	}

	async createFiles(files: Array<File>): Promise<Array<string>> {
		const res = await sendFiles("/assets/upload", files);
		const ids = await res.json();
		for (const i in ids) {
			const id = ids[i];
			await this.loadAsset(id);
		}

		return ids;
	}

	async uploadJSON(content: any, id: string, custom?: any) {
		const asset = this.get(id);

		const file = new File(
			[JSON.stringify(content)],
			`v${asset.info.revision}_${asset.info.name}`,
			{
				type: "application/json",
			}
		);

		await this.uploadAsset(id, [file], custom);
	}

	async createJSON(
		content: any,
		extension: string,
		name: string = `new`
	): Promise<Array<string>> {
		const file = new File([JSON.stringify(content)], name + "." + extension, {
			type: "application/json",
		});

		return this.createFiles([file]);
	}

	async uploadComponent(
		content: any,
		extension: string,
		bundle_name?: string | null,
		name?: string
	): Promise<string> {
		bundle_name = bundle_name ?? "base_bundle";
		if (!this.bundles[bundle_name]) {
			const bundle = {
				guids: 0,
				list: {},
				infos: {},
			};
			// now it will be handled by loadAsset function and base_bundle will be initialized
			await this.createJSON(bundle, "bundle", bundle_name);
		}

		const bundle = this.bundles[bundle_name];
		if (!bundle) {
			throw new Error(
				"Assets::uploadComponent unexpected error. Should not be like that."
			);
		}

		const id =
			bundle.content.list[content.id]?.id ??
			`${bundle.id}-c${bundle.content.guids++}`;
		name = name ?? content.name ?? `new-${id}.${extension}`;
		content.id = id;
		bundle.content.list[id] = content;
		let _info = bundle.content.infos[id];
		if (!bundle.content.infos[id]) {
			_info = {
				url: bundle.info.url,
				name: name,
				id: id,
				type: bundle.info.type,
				extension: extension,
				revision: -1,
				tags: bundle.info.tags ?? "",
			} as AssetInfo;
			bundle.content.infos[id] = _info;
		}

		_info.revision += 1;
		_info.name = name;

		await this.uploadJSON(bundle.content, bundle.id);

		return id;
	}

	async wipeAsset(id: string) {
		if (this.matters.list[id]) {
			this.matters.remove(id);
		}

		const asset = this.get(id);
		if (asset.bundle) {
			const bundle = this.bundles[asset.bundle];
			delete bundle.content.infos[id];
			delete bundle.content.list[id];
			await this.uploadJSON(bundle.content, bundle.id);

			delete this.list[id];
			return;
		}

		const res = await fetch(`/assets/wipe/${id}`, {
			method: "POST",
		});

		if (res.ok) {
			delete this.list[id];
		}
	}
}

export default Assets;

import {
	AssetContentTypeComponent,
	AssetContentTypeCollider,
	AssetContentTypeEvents,
	AssetContentTypeModel,
	AssetContentTypeTileset,
	AssetContentTypeTile,
	AssetContentTypeTexture,
	AssetContentTypeGameprop,
} from "./assets_base_extensions";

export {
	Assets,
	Asset,
	AssetStatus,
	listenFormSubmit,
	sendFiles,
	AssetContentTypeGameprop,
	AssetContentTypeComponent,
	AssetContentTypeCollider,
	AssetContentTypeEvents,
	AssetContentTypeModel,
	AssetContentTypeTileset,
	AssetContentTypeTile,
	AssetContentTypeTexture,
};
