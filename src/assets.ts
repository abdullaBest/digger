
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
        fetch("/assets_upload", {
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
