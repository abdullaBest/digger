import * as THREE from "../lib/three.module.js";

const GridWaveShaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
        // . . .
    },
    vertexShader:   
			`
varying vec2 vUv;

void main() {
    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
			`,
    fragmentShader: 
			`
#define EPSILON 0.1

varying vec2 vUv;

void main() {
    if ((fract(vUv.x * 10.0) < EPSILON)
        || (fract(vUv.y * 10.0) < EPSILON)) {
        gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0);
    } else {
        gl_FragColor = vec4(vec3(0.0), 0.0);
    }
}
			`
});

export { GridWaveShaderMaterial };
