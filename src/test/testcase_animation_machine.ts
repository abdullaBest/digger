import { AnimationNode, Animator, AnimationMachine } from "../render/animator";

export default function main(container: HTMLElement) {
	{
		const am = new AnimationMachine();
		am.register(new AnimationNode("a", null));
		am.register(new AnimationNode("b", null));
		am.register(new AnimationNode("c", null));

		// a -> b -> c
		// a ->-> c
		am.pair("a", "b");
		am.pair("b", "c");

		// a.paths: b (len 1), c (len 2)
		// b.paths: c (len 1)
		console.log("case 1", am);
	}

	{
		const am = new AnimationMachine();
		am.register(new AnimationNode("a", null));
		am.register(new AnimationNode("b", null));

		// a <--> b
		am.pair("a", "b");
		am.pair("b", "a");

		// a.paths: b (len 1), c (len 2)
		// b.paths: c (len 1)
		console.log("case 2", am);
	}

	{
		const am = new AnimationMachine();
		am.register(new AnimationNode("idle", null));
		am.register(new AnimationNode("run", null));
		am.register(new AnimationNode("hit", null));
		am.register(new AnimationNode("jump", null));
		am.register(new AnimationNode("fall", null));

		am.pair("idle", "run");
		am.pair("run", "idle");
		am.pair("idle", "jump");
		am.pair("run", "jump");
		am.pair("fall", "idle");
		am.pair("fall", "run");

		console.log("pair jump->fall");
		am.pair("jump", "fall");


		am.query("idle");
		am.query("fall");
		console.log("case 3", am);
	}

	{
		const am = new AnimationMachine();
		am.register(new AnimationNode("a", null));
		am.register(new AnimationNode("b", null));
		am.register(new AnimationNode("c", null));
		am.register(new AnimationNode("d", null));
		am.register(new AnimationNode("e", null));
		am.register(new AnimationNode("f", null));

		/*
					 e -> f
					 ^    ^
			a -> b -> c
		  ^					|
			.---------.
		 */
		// has to select path [a -> b -> c] over [a -> b -> e -> f -> c]
		am.pair("a", "b");
		am.pair("b", "c");
		am.pair("b", "e");
		am.pair("e", "f");
		am.pair("f", "c");
		am.pair("c", "a");


		console.log("case 4", am);
	}
}
