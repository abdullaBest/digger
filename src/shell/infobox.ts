import { LogCode, logger } from "../core/logger";

class Infobox {
	private static _instance: Infobox;
	container: HTMLElement;

	static get instance() {
		if (!Infobox._instance) {
			Infobox._instance = new Infobox();
		}

		return Infobox._instance;
	}

	init(container: HTMLElement) {
		this.container = container;
	}

	print(message: string, code: LogCode, duration: number = 3) {
		const box = document.createElement("div");
		box.classList.add("infobox", LogCode[code]);
		box.innerHTML = message;
		this.container.appendChild(box);
		logger.print(code, 1, message);
		setTimeout(
			() => {
				box.classList.add("fadeout");
			},
			(duration - 0.5) * 1000
		);
		setTimeout(() => {
			if (box.parentElement) {
				box.parentElement.removeChild(box);
			}
		}, duration * 1000);
	}
}

function printinfo(message: string) {
	Infobox.instance.print(message, LogCode.info);
}

function printerror(message: string, duration: number = 7) {
	Infobox.instance.print(message, LogCode.error, duration);
}

const infobox = Infobox.instance;

export default infobox;
export { Infobox, infobox, printinfo, printerror };
