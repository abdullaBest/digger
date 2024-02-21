import { Popup } from "../document/popup";
import { sendFiles, Asset } from "../app/assets";
import SceneRender from "../render/scene_render";
import Assets from "../app/assets";

function blobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
	const reader = new FileReader();
	reader.readAsDataURL(blob);
	return new Promise((resolve) => {
		reader.onloadend = () => {
			resolve(reader.result);
		};
	});
}

export async function importImageSequence(assets: Assets) {
	try {
		const input = document.createElement("input");
		await Popup.instance.show().confirm("select image", (container) => {
			input.type = "file";
			input.accept = ".png";
			input.multiple = true;
			container.appendChild(input);
		});
		if (!input.files || !input.files.length) {
			throw new Error("No files provided");
		}

		let files: Array<File> = [];
		let len = input.files?.length ?? 0;
		for (let i = 0; i < len; i++) {
			let file = input.files ? input.files[i] : null;
			if (!file) {
				continue;
			}
			files.push(file);
		}

		return assets.createFiles(files);
	} catch (err) {
		if (err == "cancel") {
			throw err;
		}

		await Popup.instance.show().message("error", err);
		return await importImageSequence(assets);
	}
}

/**
 * Creates new asset if id not passed 
 * and updates existing asset if id passed
 * @param assets {Assets}
 * @param id {string?} 
 *
 * @return 
 */
export async function importGltfSequence(assets: Assets, id?: string) {
	let gltfContents: Array<any> = [];
	let gltfFiles: Array<File> = [];
	try {
		// a. show file select popup.
		const input = document.createElement("input");
		await Popup.instance.show().confirm("select gltf", (container) => {
			input.type = "file";
			input.accept = ".gltf,.bin";
			input.multiple = true;
			container.appendChild(input);
		});

		// b. Find gltf
		let filesMap: { [id: string]: File } = {};
		let len = input.files?.length ?? 0;
		for (let i = 0; i < len; i++) {
			let file = input.files ? input.files[i] : null;
			if (!file) {
				continue;
			}
			filesMap[file.name] = file;
			if (file.name.match(/\.(gltf)$/)) {
				gltfFiles.push(file);
				gltfContents.push(JSON.parse(await file.text()));
			}
		}

		// b.1 cycle back to (a.)
		if (!gltfContents.length) {
			throw new Error("no gltf provided");
		}

		// c.1 replace buffer
		for (const i in gltfContents) {
			const gltfContent = gltfContents[i];
			for (const i in gltfContent.buffers) {
				const b = gltfContent.buffers[i];
				if (b.uri.includes("data:application/octet-stream")) {
					continue;
				}
				const depname = b.uri.split("/").pop();
				const dep = filesMap[depname];
				if (!dep) {
					throw new Error(
						`gltf requires "${b.uri}" buffer but no "${depname}" found.`
					);
				}

				const newdata = await blobToBase64(dep);

				b.uri = newdata;
				b.byteLength = dep.size;
			}

			// c.2 replace textures
			for (const i in gltfContent.images) {
				const img = gltfContent.images[i];
				const newtx = await fetch("res/missing-texture.png");
				if (!newtx.ok) {
					throw new Error("missing missing-texture.. :D");
				}
				const blob = await newtx.blob();
				const newdata = await blobToBase64(blob);
				img.mimeType = newtx.type;
				img.uri = newdata;
			}
		}
	} catch (err) {
		if (err == "cancel") {
			throw err;
		}

		await Popup.instance.show().message("error", err);
		return await importGltfSequence(assets);
	}

	const files: Array<File> = [];
	for (const i in gltfContents) {
		const gltfContent = gltfContents[i];
		const gltfFile = gltfFiles[i];
		const file = new File([JSON.stringify(gltfContent)], gltfFile.name, {
			type: "application/json",
		});
		files.push(file);
	}

	if (id) {
		return assets.uploadAsset(id, files);
	} else {
		return assets.createFiles(files);
	}
}

export function uploadThumbnail(asset: Asset, scene_render: SceneRender) {
	return new Promise((resolve, rejects) => {
		scene_render.render();
		scene_render.canvas.toBlob((blob) => {
			if (!blob || !asset) {
				rejects();
				return;
			}
			const file = new File([blob], `tumb_${asset.info.id}`, {
				type: "image/jpeg",
			});

			sendFiles("/assets/upload/thumbnail/" + asset.info.id, [file], resolve);
		});
	});
}
