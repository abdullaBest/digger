import {
	listenClick,
	EventListenerDetails,
	removeEventListeners,
} from "../document";

/*
 * Allows to view and set properties with update
 */
export default class PropertyDraw {
	container: HTMLElement;
	toggle_btn: HTMLElement | null;
	object: any;
	getters: { [id: string]: () => any };
	setters: { [id: string]: (v: any) => void };
	elements: { [id: string]: HTMLElement };
	labels_read: { [id: string]: HTMLElement };
	values_read: { [id: string]: any };
	inputs_write: { [id: string]: HTMLInputElement };
	values_write: { [id: string]: any };
	private _listeners: Array<EventListenerDetails>;

	constructor(container: HTMLElement, toggle_btn?: HTMLElement) {
		this.container = container;
		this.toggle_btn = toggle_btn ?? null;
		this._listeners = [];
	}

	init(object: any): PropertyDraw {
		this.dispose();
		this.object = object;

		if (this.toggle_btn) {
			listenClick(
				this.toggle_btn,
				async (ev) => {
					this.container.classList.toggle("hidden");
				},
				this._listeners
			);
		}

		return this;
	}

	dispose() {
		for (const k in this.elements) {
			const el = this.elements[k];
			el.parentElement?.removeChild(el);
		}

		this.elements = {};
		this.getters = {};
		this.setters = {};
		this.values_read = {};
		this.labels_read = {};
		this.values_write = {};
		this.inputs_write = {};
		this.object = null;
		removeEventListeners(this._listeners);
	}

	add(key: string, getter?: () => any) {
		this.getters[key] = getter ?? (() => this.object[key]);
		this.values_read[key] = this.getters[key]();
		this._drawRead(key);
	}

	addRead(key: string, getter?: () => any) {
		this.add(key, getter);
	}

	addWrite(key: string, getter?: () => any, setter?: (v: any) => void) {
		this.getters[key] = getter ?? (() => this.object[key]);
		this.setters[key] = setter ?? ((v: any) => (this.object[key] = v));
		this.values_write[key] = this.getters[key]();
		this._drawWrite(key);
	}

	_drawRead(key: string) {
		const value = this.getters[key]();
		if (this.elements[key] && this.values_read[key] === value) {
			return;
		}

		let label = this.labels_read[key];
		if (!label) {
			const el = document.createElement("entry");
			el.classList.add("flex-row");
			el.id = key;

			const l1 = document.createElement("t");
			l1.classList.add("flex-grow-1");
			l1.innerHTML = `${key}: `;
			el.appendChild(l1);

			label = document.createElement("t");
			el.appendChild(label);
			this.container.appendChild(el);

			this.elements[key] = el;
			this.labels_read[key] = label;
		}

		let v = value;
		if (typeof value === "number" && value % 1) {
			v = value.toFixed(2);
		}
		label.innerHTML = this.values_read[key] = v;
	}

	_drawWrite(key: string) {
		let input = this.inputs_write[key];
		if (!input) {
			const el = document.createElement("entry");
			el.classList.add("flex-row");
			el.id = key;

			const l1 = document.createElement("t");
			l1.classList.add("flex-grow-1");
			l1.innerHTML = `${key}: `;
			el.appendChild(l1);

			input = document.createElement("input");
			const value = this.getters[key]();
			const type = typeof value;
			input.value = this.getters[key]();
			input.type = typeof value;
			input.classList.add("width-half");
			el.appendChild(input);
			this.container.appendChild(el);

			this.elements[key] = el;
			this.inputs_write[key] = input;

			input.addEventListener("change", (ev) => {
				const target = ev.target as HTMLInputElement;
				if (target) {
					const _value = target.value;
					let value: any = null;
					switch (type) {
						case "number":
							value = parseFloat(_value);
							if (Number.isNaN(value)) {
								input.classList.add("error");
								return;
							}
							break;
						case "boolean":
							value =
								_value == "true" ? true : _value == "false" ? false : !!value;
							break;
						default:
							console.warn("No implemetation for input " + type);
							return;
					}

					input.classList.remove("error");

					this.setters[key](value);
				}
			});
		}
	}

	step() {
		for (const k in this.values_read) {
			this._drawRead(k);
		}
	}
}
