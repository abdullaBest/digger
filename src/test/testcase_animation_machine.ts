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
		console.log(am);
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
		console.log(am);
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


		console.log(am);
	}
}
