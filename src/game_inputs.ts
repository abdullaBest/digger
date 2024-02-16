import Events from "./events";
import { addEventListener, EventListenerDetails } from "./document";

enum InputAction {
	left = 0,
	up = 1,
	right = 2,
	down = 3,
	acion_a = 4,
	acion_b = 5,
	acion_c = 6,
	acion_d = 7,
	acion_f = 8,
	action_shift = 9,
	action_esc = 10
}

class GameInputs {
	events: Events;
	private _listeners: Array<EventListenerDetails>;

	constructor() {
		this.events = new Events();
	}

	init() {
		addEventListener(
			{
				callback: this._keydown.bind(this),
				name: "keydown",
				node: document.body,
			},
			this._listeners
		);
		addEventListener(
			{ callback: this._keyup.bind(this), name: "keyup", node: document.body },
			this._listeners
		);
	}

	_keydown(event: KeyboardEvent) {
		if (event.repeat) return;

		const key = event.code;
		switch (key) {
			case "Escape":
				this.events.emit("action_start", InputAction.action_esc);
				break;
			case "ArrowLeft":
				this.events.emit("action_start", InputAction.left);
				break;
			case "ArrowUp":
				this.events.emit("action_start", InputAction.up);
				break;
			case "ArrowRight":
				this.events.emit("action_start", InputAction.right);
				break;
			case "ArrowDown":
				this.events.emit("action_start", InputAction.down);
				break;
			case "Space":
				this.events.emit("action_start", InputAction.acion_a);
				break;
			case "KeyA":
				this.events.emit("action_start", InputAction.acion_b);
				break;
			case "KeyW":
				this.events.emit("action_start", InputAction.acion_c);
				break;
			case "KeyS":
				this.events.emit("action_start", InputAction.acion_d);
				break;
			case "ShiftLeft":
				this.events.emit("action_start", InputAction.action_shift);
				break;
		}
	}
	_keyup(event: KeyboardEvent) {
		if (event.repeat) return;

		const key = event.code;
		switch (key) {
			case "Escape":
				this.events.emit("action_end", InputAction.action_esc);
				break;
			case "ArrowLeft":
				this.events.emit("action_end", InputAction.left);
				break;
			case "ArrowUp":
				this.events.emit("action_end", InputAction.up);
				break;
			case "ArrowRight":
				this.events.emit("action_end", InputAction.right);
				break;
			case "ArrowDown":
				this.events.emit("action_end", InputAction.down);
				break;
			case "Space":
				this.events.emit("action_end", InputAction.acion_a);
				break;
			case "KeyA":
				this.events.emit("action_end", InputAction.acion_b);
				break;
			case "KeyW":
				this.events.emit("action_end", InputAction.acion_c);
				break;
			case "KeyS":
				this.events.emit("action_end", InputAction.acion_d);
				break;
			case "ShiftLeft":
				this.events.emit("action_end", InputAction.action_shift);
				break;
		}
	}
}

export default GameInputs;
export { InputAction, GameInputs };
