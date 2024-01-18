
import * as THREE from '../lib/three.module.js';

 /**
     * Avoiding typescript errors
     * @param o 
     * @param pos 
     */
 export function setObjectPos(o: THREE.Object3D, pos: THREE.Vector3) {
    if((o as any).position) {
        (o as any).position.copy(pos);
    }
}

export function setCameraPos(pos: THREE.Vector3, target: THREE.Vector3, camera: THREE.Camera, controls?: any) {
    setObjectPos(camera, pos);
    camera.lookAt(target.x, target.y, target.z);
    if (controls) {
        controls.target.copy(target);
    }
}

export function focusCameraOn(object: THREE.Object3D, camera: THREE.Camera, normal: THREE.Vector3 =  new THREE.Vector3(0, 0, 1), controls?: any) {
    const box = new THREE.Box3().setFromObject( object );
    const center = box.getCenter(new THREE.Vector3())
    const sphere = box.getBoundingSphere(new THREE.Sphere(center));

    const pos = normal.multiplyScalar(sphere.radius + Math.log(sphere.radius * 1.3));
    setCameraPos(pos, center, camera, controls);
}