import Events from "./events";
import { addEventListener, EventListenerDetails } from "../document/utils";

enum InputAction {
	left = 0,
	up = 1,
	right = 2,
	down = 3,
	action_a = 4,
	action_b = 5,
	action_c = 6,
	action_d = 7,
	action_f = 8,
	action_shift = 9,
	action_esc = 10,
	action_cmd = 11,
	action_enter = 12,
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
				this.events.emit("action_start", InputAction.action_a);
				break;
			case "KeyA":
				this.events.emit("action_start", InputAction.action_b);
				break;
			case "KeyW":
				this.events.emit("action_start", InputAction.action_c);
				break;
			case "KeyS":
				this.events.emit("action_start", InputAction.action_d);
				break;
			case "KeyQ":
				this.events.emit("action_start", InputAction.action_f);
				break;
			case "ShiftLeft":
				this.events.emit("action_start", InputAction.action_shift);
				break;
			case "Backquote":
				this.events.emit("action_start", InputAction.action_cmd);
				break;
			case "Enter":
				this.events.emit("action_start", InputAction.action_enter);
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
				this.events.emit("action_end", InputAction.action_a);
				break;
			case "KeyA":
				this.events.emit("action_end", InputAction.action_b);
				break;
			case "KeyW":
				this.events.emit("action_end", InputAction.action_c);
				break;
			case "KeyS":
				this.events.emit("action_end", InputAction.action_d);
				break;
			case "KeyQ":
				this.events.emit("action_end", InputAction.action_f);
				break;
			case "ShiftLeft":
				this.events.emit("action_end", InputAction.action_shift);
				break;
			case "Backquote":
				this.events.emit("action_end", InputAction.action_cmd);
				break;
			case "Enter":
				this.events.emit("action_end", InputAction.action_enter);
				break;
		}
	}
}

export default GameInputs;
export { InputAction, GameInputs };
