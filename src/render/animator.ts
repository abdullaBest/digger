import * as THREE from '../lib/three.module.js';

interface AnimationPath {
	length: number;
	start: string;
	end: string;
	next: string;
}

class AnimationNode {
	id: string;
	clip: THREE.AnimationAction;
	edges: { [id: string] : AnimationEdge };
	paths: { [id: string] : AnimationPath };
	constructor(id: string, clip: THREE.AnimationAction) {
		this.id = id;
		this.clip = clip;
		this.edges = {};
		this.paths = {};
	}
}

class AnimationEdge {
	start: string;
	end: string;
	id: string;
	constructor(start: string, end: string) {
		this.start = start;
		this.end = end;
		this.id = `${start}-${end}`;
	}
}

/**
 * Builds node graph for animation sequences
 */
class AnimationMachine {
	nodes: { [id: string] : AnimationNode };
	edges: { [id: string] : AnimationEdge };
	constructor() {
		this.nodes = {};
		this.edges = {};
	}

	/*
	 * Adds new node into scope
	 */
	register(node: AnimationNode) {
		if (this.nodes[node.id]) {
			throw new Error(`AnimationMachine::register error - node "${node.id}" already exists`);
		}

		this.nodes[node.id] = node;
	}

	/*
	 * Creates connection between two nodes. Also calculates all connection paths
	 */
	pair(from: string, to: string) {
		const nodea = this.nodes[from];
		const nodeb = this.nodes[to];

		if (!nodea || !nodeb) {
			throw new Error(`AnimationMachine::pair error - node "${from}" or "${to}" was not registered`);
		}

		const edge = new AnimationEdge(from, to);
		if (this.edges[edge.id]) {
			throw new Error(`AnimationMachine::pair error - edge ${edge.id} already exists`);
		}

		this.edges[edge.id] = edge;
		nodea.edges[edge.id] = edge;
		nodeb.edges[edge.id] = edge;
		this._build_path(nodea);
	}

	/**
	 * @param node {AnimationNode} new node to calculate pah
	 * @param _startnide {AnimationNode} internal deadlock safe
	*/
	_build_path(node: AnimationNode, _startnode: AnimationNode | null = null) {

		// full loop reached
		if (node === _startnode) {
			return;
		}

		// a. build direct path
		for(const k in node.edges) {
			const edge = node.edges[k];
			if (edge.start != node.id) {
				continue;
			}

			const nodeb = this.nodes[edge.end]

			// a.1 build direct path
			node.paths[nodeb.id] = {
				length: 1,
				start: edge.start,
				end: edge.end,
				next: edge.end
			}

			// a.2 build all dependent path
			
			for (const pk in nodeb.paths) {
				const path = nodeb.paths[pk];
				if ((node.paths[path.end]?.length ?? Infinity) < path.length) {
					continue;
				}	
				node.paths[path.end] = {
					length: path.length + 1,
					start: node.id,
					end: path.end,
					next: nodeb.id
				}
			}
		}

		// b. traverse all paths
		for(const k in node.edges) {
			const edge = node.edges[k];
			if (edge.end != node.id) {
				continue;
			}

			this._build_path(this.nodes[edge.start], _startnode ?? node);
		}
	}


	/*
	 * Traveling through nodes till reaches target one
	 */
	transite(target: string) {
	}

	/*
	 * Appends transition into query
	 */
	query(target: string) {
	}
}

class Animator {
    animation_mixer: THREE.AnimationMixer;
    animation_time_scale: number;
		animation_machine: AnimationMachine;
    animations_actions_cache: {[id: string] : THREE.AnimationAction};

		scene: THREE.Scene;
		gltf: any;

		constructor() {
			this.animation_time_scale = 1;
		}

		init(scene: THREE.Scene, gltf: any) {
			this.scene = scene;
			this.gltf = gltf;
			this.animation_mixer = new THREE.AnimationMixer(scene);
			this.animation_machine = new AnimationMachine();
			this.animations_actions_cache = {};
		}

    step(dt: number) {
			if (this.animation_mixer) {
				this.animation_mixer.update(dt * this.animation_time_scale);
			}
		}

    getAnimation(name: string | null, gltf = this.gltf) : THREE.AnimationAction | null {
        if (!name) {
            return null;
        }

        if (!this.animation_mixer) {
            throw new Error("CharacterRender::playAnimation error - No animation mixer set");
        }

        let action = this.animations_actions_cache[name] ?? this.animation_mixer.clipAction(THREE.AnimationClip.findByName(gltf, name));
        if (!action) {
            return null;
        }
        this.animations_actions_cache[name] = action;
        action.play();
        action.setEffectiveWeight( 0 );
        return action;
    }
}

export default Animator;
export { Animator, AnimationMachine, AnimationNode };
