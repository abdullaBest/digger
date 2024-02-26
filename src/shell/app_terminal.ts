import { addEventListener, querySelector } from "../document";
import { LogCode } from "../core/logger";

export default class AppTerminal {
	container: HTMLElement;
	input: HTMLInputElement;
	content: HTMLElement;
	hidden: boolean;

	init(container: HTMLElement) {
		this.container = container;
		this.content = querySelector(".content", this.container); 
		this.input = querySelector("input", this.container) as HTMLInputElement;
		this.hidden = this.container.classList.contains("hidden");

		addEventListener({
			callback: (ev) => {

			},
			name: "change",
			node: querySelector("input", this.container)
		});
	}

	toggle() {
		this.hidden = this.container.classList.toggle("hidden");
		if (!this.hidden) {
			requestAnimationFrame(() => this.input.focus());
		}
	}

	confirm() {
		if (this.hidden) {
			return;
		}

		const text = this.input.value;
		this.input.value = "";
		this.print(LogCode.details, "> " + text);
		this.command(text);
	}

	command(message: string) {
		switch (message) {
			default:
				this.print(LogCode.error, `No command <b>${message}</b> found`);
		}
	}

	print(code: LogCode, message: string) {
		const t = document.createElement("t");
		t.innerHTML = message;
		t.classList.add(LogCode[code]);
		this.content.appendChild(t);
		this.content.scrollTop = this.content.scrollHeight;
	}
}
