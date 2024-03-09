import { Matters, Matter } from "../core/matters";

// New component types has to be placed:
// a. new ts interface type
// b. ts interface listed in BaseContentExtensionsList 
// c. new base object with all default data
// d. object returned by cunstructBaseExtensionsData
// --- also
// 1. in views/tab-library button should be added
// 2. in views/asset_library_view button callback should be added

export interface AssetContentTypeComponent extends Matter {
	type: string;
	/**
	 * Used to indicate that componet attached to another component and should not be listed in global scope
	 */
	owner?: string | null;

	/**
	 * Indicates that component should not be added into scene tree
	 * probably should call it "static"
	 */
	abstract?: boolean | null;

	matrix?: Array<number> | null;
	pos_x?: number | null;
	pos_y?: number | null;
}

export interface AssetContentTypeTrigger extends AssetContentTypeComponent {
	user_interact: boolean;
	user_collide: boolean;
	event: string;
	toggle: boolean;
}

export interface AssetContentTypeWireplug extends AssetContentTypeComponent {
	guids: number;
	filter: string;
	hold: number;
	release: number;
}

export interface AssetContentTypeTimer extends AssetContentTypeComponent {
	delay: number;
	interval: number;
}

export interface AssetContentTypeCollider extends AssetContentTypeComponent {
	trigger: boolean;
	autosize: boolean;
	width: number;
	height: number;
	x: number;
	y: number;
}

export interface AssetContentTypeGameprop extends AssetContentTypeComponent {
	durability: number;
	resistance: number;
	falling: boolean;
	damage: number;
}

export interface AssetContentTypeSpace extends AssetContentTypeComponent {
	guids: number;
}

export interface AssetContentTypeTexture extends AssetContentTypeComponent {
	asset: HTMLImageElement;
	url: string;
}

export interface AssetContentTypeGltf extends AssetContentTypeComponent {
	url: string;
}

export interface AssetContentTypeModel extends AssetContentTypeComponent {
	gltf: string;
	material: string;
	texture: string;
	// allows to pick one object inside gltf file
	filter?: string | null;
}

export interface AssetContentTypeAnimator extends AssetContentTypeComponent {
	// animation name that will be set to 0 on component creation
	initial: string;
	// animation name that will be played on idle
	idle: string;
	// animation name that will be played in active
	active: string;
	// animation name thiat will be played on activation
	activate: string;
	deactivate: string;
}

export interface AssetContentTypeController extends AssetContentTypeComponent {
	hide: string;
}

export interface AssetContentTypeTileset extends AssetContentTypeComponent {
	guids: number;
	texture: string;
	zero_color: string;
	color_id_prefix: string;
	link_id_prefix: string;
	durability_id_prefix: string;
	tilesize_x: number;
	tilesize_y: number;
	pos_x: number;
	pos_y: number;
}

export interface AssetContentTypeTile extends AssetContentTypeComponent {
	color: string;
	link: string;
}

export interface BaseContentExtensionsList {
	component: AssetContentTypeComponent;
	space: AssetContentTypeSpace;
	trigger: AssetContentTypeTrigger;
	wireplug: AssetContentTypeWireplug;
	timer: AssetContentTypeTimer;
	texture: AssetContentTypeTexture;
	collider: AssetContentTypeCollider;
	gameprop: AssetContentTypeGameprop;
	model: AssetContentTypeModel;
	gltf: AssetContentTypeGltf;
	animator: AssetContentTypeAnimator;
	controller: AssetContentTypeController;
	tileset: AssetContentTypeTileset;
	tile: AssetContentTypeTile;
}

export function cunstructBaseExtensionsData(
	matters: Matters
): BaseContentExtensionsList {
	const base_asset_extension_component = { type: "component" };
	const base_asset_extension_space = { type: "space", guids: 0 };
	const base_asset_extension_trigger = {
		type: "trigger",
		user_interact: false,
		user_collide: false,
		toggle: false,
		event: ""
	};
	const base_asset_extension_wireplug = {
		type: "wireplug",
		filter: "",
		hold: 0,
		release: 0,
		guids: 0
	}
	const base_asset_extension_timer = {
		type: "timer",
		delay: 0,
		//interval: 0
	}
	const base_asset_extension_texture = { type: "texture", abstract: true, asset: null };
	const base_asset_extension_collider = {
		type: "collider",
		autosize: true,
		trigger: false,
		width: 0,
		height: 0,
		x: 0,
		y: 0
	};
	const base_asset_extension_gameprop = {
		type: "gameprop",
		durability: 1,
		resistance: 999,
		falling: false,
		damage: 0
	};
	const base_asset_extension_gltf = {
		type: "gltf",
		abstract: true,
		url: "toset"
	}
	const base_asset_extension_model = {
		type: "model",
		gltf: "toset",
		material: "standart",
		texture: "toset",
		matrix: null,
	};
	const base_asset_extension_animator = {
		type: "animator",
		initial: "",
		idle: "",
		active: "",
		activate: "",
		deactivate: "",
	}
	const base_asset_extension_controller = {
		type: "controller",
		hide: ""
	}
	const base_asset_extension_tileset = {
		type: "tileset",
		texture: "toset",
		zero_color: "#ffffffff",
		tilesize_x: 1,
		tilesize_y: 1,
		pos_x: 0,
		pos_y: 0,
	};
	const base_asset_extension_tile = {
		type: "tile",
		color: "#000000",
		link: "toset",
		abstract: true,
	};

	return {
		component: matters.create(
			base_asset_extension_component,
			null,
			"base_asset_type_component"
		) as AssetContentTypeComponent,
		trigger: matters.create(
			base_asset_extension_trigger,
			"base_asset_type_component",
			"base_asset_type_trigger"
		) as AssetContentTypeTrigger,
		wireplug: matters.create(
			base_asset_extension_wireplug,
			"base_asset_type_component",
			"base_asset_type_wireplug"
		) as AssetContentTypeWireplug,
		timer: matters.create(
			base_asset_extension_timer,
			"base_asset_type_component",
			"base_asset_type_timer"
		) as AssetContentTypeTimer,
		space: matters.create(
			base_asset_extension_space,
			"base_asset_type_component",
			"base_asset_type_space"
		) as AssetContentTypeSpace,
		texture: matters.create(
			base_asset_extension_texture,
			"base_asset_type_component",
			"base_asset_type_texture"
		) as AssetContentTypeTexture,
		collider: matters.create(
			base_asset_extension_collider,
			"base_asset_type_component",
			"base_asset_type_collider"
		) as AssetContentTypeCollider,
		gameprop: matters.create(
			base_asset_extension_gameprop,
			"base_asset_type_component",
			"base_asset_type_gameprop"
		) as AssetContentTypeGameprop,
		gltf: matters.create(
			base_asset_extension_gltf,
			"base_asset_type_component",
			"base_asset_type_gltf"
		) as AssetContentTypeGltf,
		model: matters.create(
			base_asset_extension_model,
			"base_asset_type_component",
			"base_asset_type_model"
		) as AssetContentTypeModel,
		animator: matters.create(
			base_asset_extension_animator,
			"base_asset_type_component",
			"base_asset_type_animator"
		) as AssetContentTypeAnimator,
		controller: matters.create(
			base_asset_extension_controller,
			"base_asset_type_component",
			"base_asset_type_controller"
		) as AssetContentTypeController,
		tileset: matters.create(
			base_asset_extension_tileset,
			"base_asset_type_component",
			"base_asset_type_tileset"
		) as AssetContentTypeTileset,
		tile: matters.create(
			base_asset_extension_tile,
			"base_asset_type_component",
			"base_asset_type_tile"
		) as AssetContentTypeTile,
	};
}
