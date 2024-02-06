

/**
 * starts to listen form "submit" and posts request on such
 * @param opts func options
 * @param opts.form form to work with
 * @param opts.url url path to post
 * @param opts.fields input names
 * @param opts.files file input names
 * @param opts.custom custom content generators
 * @param callback callback of form response
 */
export function listenFormSubmit(
	opts: {
		form: HTMLFormElement | null;
		url: string;
		fields?: Array<string> | null;
		files?: Array<string> | null;
		custom?: { [id: string]: () => any };
	},
	callback: (success: boolean, response: Response) => void
) {
	const form = opts.form;
	const url = opts.url;
	const fields = opts.fields;
	const files = opts.files;
	const custom = opts.custom;

	if (!form) {
		throw new Error("form is null");
	}
	form.addEventListener("submit", submitForm);

	async function submitForm(e) {
		e.preventDefault();
		if (!form) {
			throw new Error("form is null");
		}

		const formData = new FormData();
		for (const i in fields) {
			const k = fields[i];
			const el = form.querySelector(`[name='${k}']`);
			if (!el) {
				continue;
			}

			formData.append(k, (el as HTMLInputElement).value);
		}

		for (const i in files) {
			const k = files[i];
			const f = form.querySelector(`[name='${k}']`) as HTMLInputElement;
			if (!f) {
				continue;
			}
			let len = f?.files?.length ?? 0;
			for (let i = 0; i < len; i++) {
				let file = f?.files ? f?.files[i] : null;
				if (file) {
					formData.append(k, file);
				}
			}
		}

		for (const k in custom) {
			const data = custom[k]();
			if (data) {
				formData.append(k, data);
			}
		}

		const res = await fetch(url, {
			method: "POST",
			body: formData,
			headers: {},
		});
		callback(res.ok, res);
	}
}

export async function sendFiles(
	url,
	files?: Array<File>,
	custom?: any,
	callback?: (success: boolean, response: Response) => void
): Promise<Response> {
	const formData = new FormData();
	for (const i in files) {
		formData.append("files", files[i]);
	}
	for (const k in custom) {
		formData.append(k, custom[k]);
	}
	const res = await fetch(url, {
		method: "POST",
		body: formData,
		headers: {},
	});
	if (callback) {
		callback(res.ok, res);
	}

	return res;
}
