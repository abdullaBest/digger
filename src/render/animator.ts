import * as THREE from "../lib/three.module.js";
import Events from "../core/events";

interface AnimationPath {
	length: number;
	start: string;
	end: string;
	next: string;
}

/*
    Instant: Will switch to the next state immediately. The current state will end and blend into the beginning of the new one.

    Sync: Will switch to the next state immediately, but will seek the new state to the playback position of the old state.

    End: Will wait for the current state playback to end, then switch to the beginning of the next state animation.
*/
enum AnimationTransitionMode {
	instant = 0,
	sync = 1,
	end = 2,
}

enum AnimationPlaybackMode {
	default = 0,
	at_start = 1,
}

class AnimationNode {
	events: Events;
	id: string;
	action: THREE.AnimationAction;
	edges: { [id: string]: AnimationEdge };
	paths: { [id: string]: AnimationPath };
	playback_mode: AnimationPlaybackMode;
	constructor(id: string, action: THREE.AnimationAction) {
		this.id = id;
		this.action = action;
		this.edges = {};
		this.paths = {};
		this.playback_mode = AnimationPlaybackMode.default;

		this.events = new Events();
	}
}

class AnimationEdge {
	start: string;
	end: string;
	id: string;
	transition_mode: AnimationTransitionMode;
	constructor(start: string, end: string) {
		this.transition_mode = AnimationTransitionMode.instant;
		this.start = start;
		this.end = end;
		this.id = `${start}-${end}`;
	}
}

/**
 * Builds node graph for animation sequences
 */
class AnimationMachine {
	nodes: { [id: string]: AnimationNode };
	edges: { [id: string]: AnimationEdge };
	query_nodes: Array<string>;

	constructor() {
		this.nodes = {};
		this.edges = {};
		this.query_nodes = [];
	}

	/*
	 * Adds new node into scope
	 */
	register(node: AnimationNode) {
		if (this.nodes[node.id]) {
			throw new Error(
				`AnimationMachine::register error - node "${node.id}" already exists`
			);
		}

		this.nodes[node.id] = node;
	}

	/*
	 * Creates connection between two nodes. Also calculates all connection paths
	 */
	pair(
		from: string,
		to: string,
		transition_mode: AnimationTransitionMode = AnimationTransitionMode.instant
	) {
		const nodea = this.nodes[from];
		const nodeb = this.nodes[to];

		if (!nodea || !nodeb) {
			throw new Error(
				`AnimationMachine::pair error - node "${from}" or "${to}" was not registered`
			);
		}

		const edge = new AnimationEdge(from, to);
		if (this.edges[edge.id]) {
			throw new Error(
				`AnimationMachine::pair error - edge ${edge.id} already exists`
			);
		}

		edge.transition_mode = transition_mode;
		this.edges[edge.id] = edge;
		nodea.edges[nodeb.id] = edge;
		nodeb.edges[edge.id] = edge;
		this._build_path(nodea);
	}

	/**
	 * @param node {AnimationNode} new node to calculate pah
	 * @param _traversed {AnimationNode} internal deadlock safe
	 */
	_build_path(
		node: AnimationNode,
		_traversed: { [id: string]: AnimationNode } = {}
	) {
		// full loop reached
		if (_traversed[node.id]) {
			return;
		}

		_traversed[node.id] = node;

		// a. build direct path
		for (const k in node.edges) {
			const edge = node.edges[k];
			if (edge.start != node.id) {
				continue;
			}
			const nodeb = this.nodes[edge.end];

			// a.1 build direct path
			node.paths[nodeb.id] = {
				length: 1,
				start: edge.start,
				end: edge.end,
				next: edge.end,
			};

			// a.2 build all dependent path

			for (const pk in nodeb.paths) {
				const path = nodeb.paths[pk];
				if ((node.paths[path.end]?.length ?? Infinity) - 1 < path.length) {
					continue;
				}
				node.paths[path.end] = {
					length: path.length + 1,
					start: node.id,
					end: path.end,
					next: nodeb.id,
				};
			}
		}

		// b. traverse all paths
		for (const k in node.edges) {
			const edge = node.edges[k];
			if (edge.end != node.id) {
				continue;
			}

			this._build_path(this.nodes[edge.start], _traversed);
		}
	}

	/*
	 * Queries all nodes into sequence
	 */
	query(target: string, instant: boolean = true) {
		if (!this.query_nodes.length) {
			this.query_nodes.push(this.nodes[target].id);
			return;
		}

		if (instant) {
			while (this.query_nodes.length > 1) {
				this.query_nodes.pop();
			}
		}

		let nodename = this.query_nodes[this.query_nodes.length - 1];

		while (nodename !== target) {
			const node = this.nodes[nodename];
			const next = node.paths[target]?.next;

			if (!next) {
				throw new Error(
					`AnimationMachine::query error - ${this.query_nodes[0]} has no path to ${target}`
				);
			}

			nodename = this.nodes[next].id;
			this.query_nodes.push(nodename);
		}
	}
}

/*
 * Core behaviour inspired by animation - https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html#statemachine
 */
class Animator {
	animation_mixer: THREE.AnimationMixer;
	animation_machine: AnimationMachine;
	animations_actions_cache: { [id: string]: THREE.AnimationAction };

	fadetime: number;
	animation_time_scale: number;

	scene: THREE.Scene;
	gltf: any;

	constructor() {
		this.animation_time_scale = 1;
		this.fadetime = 0.1;
	}

	init(scene: THREE.Scene, gltf: any) {
		this.scene = scene;
		this.gltf = gltf;
		this.animation_mixer = new THREE.AnimationMixer(scene);
		this.animation_machine = new AnimationMachine();
		this.animations_actions_cache = {};
		this.animation_mixer.addEventListener(
			"loop",
			this._on_mixer_loop.bind(this)
		);
	}

	_on_mixer_loop(event) {
		const action = event.action as THREE.AnimationAction;

		const nodename = this.animation_machine.query_nodes[0];
		const node = this.animation_machine.nodes[nodename];
		if (action != node.action) {
			return;
		}

		if (this.animation_machine.query_nodes.length <= 1) {
			return;
		}

		this._play_next();
	}

	_play_next() {
		if (this.animation_machine.query_nodes.length > 1) {
			const nodename = this.animation_machine.query_nodes.shift();
			const node = this.animation_machine.nodes[nodename];
			const oldaction = node.action;
			this.actionFadeOut(oldaction);
		}

		const nodename = this.animation_machine.query_nodes[0];
		const node = this.animation_machine.nodes[nodename];
		const newaction = node.action;
		if (node.playback_mode === AnimationPlaybackMode.at_start) {
			newaction.time = 0;
		}
		this.actionFadeIn(newaction);
	}

	step(dt: number) {
		if (this.animation_mixer) {
			this.animation_mixer.update(dt * this.animation_time_scale);
		}
	}

	transite(target: string, instant: boolean = true) {
		const qn = this.animation_machine.query_nodes;
		const last_node = qn[qn.length - 1];
		if (target === last_node) {
			return;
		}

		this.animation_machine.query(target, instant);

		// switch instantly if node type allows
		const node0 = qn[0];
		const node1 = qn[1];
		const edge = this.animation_machine.nodes[node0]?.edges[node1];
		if (edge && edge.transition_mode !== AnimationTransitionMode.instant) {
			return;
		}

		this._play_next();
	}

	actionFadeOut(action: THREE.AnimationAction) {
		action.paused = true;
		action.setEffectiveWeight(1);
		action.fadeOut(this.fadetime);
	}

	actionFadeIn(action: THREE.AnimationAction) {
		action.paused = false;
		action.enabled = true;
		action.setEffectiveWeight(1);
		action.fadeIn(this.fadetime);
	}

	getAnimation(
		name: string | null,
		gltf = this.gltf
	): THREE.AnimationAction | null {
		if (!name) {
			return null;
		}

		if (!this.animation_mixer) {
			throw new Error(
				"CharacterRender::playAnimation error - No animation mixer set"
			);
		}

		let action =
			this.animations_actions_cache[name] ??
			this.animation_mixer.clipAction(
				THREE.AnimationClip.findByName(gltf, name)
			);
		if (!action) {
			return null;
		}
		this.animations_actions_cache[name] = action;
		action.play();
		action.enabled = true;
		action.paused = true;
		action.setEffectiveTimeScale(1);
		action.setEffectiveWeight(0);
		return action;
	}
}

export default Animator;
export {
	Animator,
	AnimationMachine,
	AnimationNode,
	AnimationTransitionMode,
	AnimationPlaybackMode,
};
