export default class SceneRenderDebugs {
    drawColliderDebug(id: string, collider: BoxColliderC, color?: number, shift?: THREE.Vector2) {
        let plane = this.cache.debug_colliders[id];

        color = color ?? collider.type == ColliderType.RIGID ? 0x00ffff : 0xff00ff;

        if (!plane) {
            const geometry = new THREE.PlaneGeometry( 1, 1 );
            // tynroar tmp todo: move material into cache
            const material = new THREE.MeshStandardMaterial( { color, wireframe: true } );
            plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
        }

        let shift_x = 0;
        let shift_y = 0;
        if (shift) {
            shift_x = shift.x;
            shift_y = shift.y;
        }

        this.setPos(plane, new THREE.Vector3(collider.x + shift_x, collider.y + shift_y, this.colliders.origin.z))
        const planepos = (plane as any).position;
        (plane as any).scale.set(collider.width, collider.height, 1);
        plane.lookAt(planepos.x + this.colliders.normal.x, planepos.y + this.colliders.normal.y, this.colliders.origin.z + this.colliders.normal.z);
        this.cache.debug_colliders[id] = plane;
    }
}