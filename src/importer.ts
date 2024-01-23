import { popupConfirm } from "./page/popup";
import { sendFiles } from "./assets";

function blobToBase64(blob : Blob) : Promise<string | ArrayBuffer | null> {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise(resolve => {
      reader.onloadend = () => {
        resolve(reader.result);
      };
    });
};

export async function importGltfSequence() {
    let gltfContents: Array<any> = [];
    let gltfFiles: Array<File> = [];
    try {
        // a. show file select popup.
        const input = document.createElement("input");
        await popupConfirm("select gltf", (container) => {
            input.type = "file";
            input.accept = ".gltf,.bin";
            input.multiple = true;
            container.appendChild(input);
        });

        // b. Find gltf
        let filesMap: {[id: string] : File} = {};
        let len = input.files?.length ?? 0;
        for (let i =0; i < len; i++) {
            let file = input.files ? input.files[i] : null;
            if (!file) {
                continue
            }
            filesMap[file.name] = file;
            if(file.name.match(/\.(gltf)$/)) {
                gltfFiles.push(file);
                gltfContents.push(JSON.parse(await file.text()))
            }
        }

        // b.1 cycle back to (a.)
        if (!gltfContents.length) {
            throw new Error("no gltf provided");
        }
        
        // c.1 replace buffer
        for(const i in gltfContents) {
            const gltfContent = gltfContents[i];
            for (const i in gltfContent.buffers) {
                const b = gltfContent.buffers[i];
                if (b.uri.includes("data:application/octet-stream")) {
                    continue;
                }
                const depname = b.uri.split('/').pop();
                const dep = filesMap[depname];
                if (!dep) {
                    throw new Error(`gltf requires "${b.uri}" buffer but no "${depname}" found.`);
                }

                const newdata = await blobToBase64(dep);

                b.uri = newdata;
                b.byteLength = dep.size;
            }

            // c.2 replace textures
            for (const i in gltfContent.images) {
                const img = gltfContent.images[i];
                const newtx = await fetch('res/missing-texture.png');
                if (!newtx.ok) {
                    throw new Error("missing missing-texture.. :D");
                }
                const blob = await newtx.blob()
                const newdata = await blobToBase64(blob);
                img.mimeType = newtx.type;
                img.uri = newdata;
            }
        }

    } catch(err) {
        if (err == 'cancel') {
            throw err;
        }

        await popupConfirm(err);
        return await importGltfSequence();
    }

    const files: Array<File> = [];
    for(const i in gltfContents) {
        const gltfContent = gltfContents[i];
        const gltfFile = gltfFiles[i];
        const file = new File([JSON.stringify(gltfContent)], gltfFile.name, {
            type: "application/json",
        });
        files.push(file);
    }

    return await sendFiles("/assets/upload", files);
}