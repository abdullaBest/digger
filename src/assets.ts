
export function listenUploadsForm(form: HTMLFormElement | null) {
    if (!form) {
        throw new Error("form is null");
    }
    form.addEventListener("submit", submitForm);

    function submitForm(e) {
        e.preventDefault();
        if (!form) {
            throw new Error("form is null");
        }
        const files = form.querySelector('#assets_upload_files') as HTMLInputElement;
        const formData = new FormData();
        
        let len = files?.files?.length ?? 0;
        for(let i =0; i < len; i++) {
            let file = files?.files ? files?.files[i] : null;
            if(file) {
                formData.append("files", file);
            }
        }
        fetch("/assets/upload", {
            method: 'POST',
            body: formData,
            headers: {
              //"Content-Type": "multipart/form-data"
            }
        })
            .then((res) => console.log(res))
            .catch((err) => console.error(err));
    }
}

// tynroar todo: catch exceptions
async function loadAsset(rootel: HTMLElement, id: String) {
    const path = "/assets/load/" + id;
    const res = await fetch(path);
    if(res.ok) {
        const data = await res.blob();
        console.log(res);
        rootel.innerHTML += `
        <tileicon assetid="${id}" assetpic="${path}"></tileicon>
        `
    } else {
        console.error("asset loading error", res);
    }
}

export async function loadAllAssets(rootel: HTMLElement | null) {
    if (!rootel) {
        throw new Error("assets rootel is null");
    }
    rootel.innerHTML = '';
    const res = await fetch("/assets/list");
    const data = await res.json();
    for(const i in data) {
        loadAsset(rootel, data[i]);
    }
}