enum InfoLevel {
	info = 0,
	warn = 1,
	error = 2,
}

export class Infobox {
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

	print(message: string, level: InfoLevel, duration: number = 3) {
		const box = document.createElement("div");
		box.classList.add("infobox", InfoLevel[level]);
		box.innerHTML = message;
		this.container.appendChild(box);
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

export function printinfo(message: string) {
	Infobox.instance.print(message, InfoLevel.info);
}

export function printerror(message: string, duration: number = 7) {
	Infobox.instance.print(message, InfoLevel.error, duration);
}
