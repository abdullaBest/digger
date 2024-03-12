import { lerp } from "../core/math";

export default class GadgetTorch {
	amount: number;
	fadetime: number;
	max_strength: number;

	constructor() {
		this.amount = 1;
		this.fadetime = 30;
		this.max_strength = 10;
	}

	init() {
		this.amount = 1;
	}

	step(dt: number) {
		this.amount = Math.max(0, this.amount - dt / this.fadetime);
	}

	getStrength() {
		let s =
			this.amount > 0.25
				? this.max_strength
				: lerp(0, this.max_strength, 1 - Math.pow(1 - this.amount * 4, 4));

		s += this.amount * Math.max(1, Math.random() + 0.5);

		return s;
	}
}
