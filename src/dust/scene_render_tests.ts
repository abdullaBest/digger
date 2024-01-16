class SceneRenderTests {
    
    // --- tests

    test() {
        const porigin = new THREE.Vector3(0, 0, 0);
        const pnormal = new THREE.Vector3(0, 0, 1).normalize();
		//const onplane = this.intersectLinePlane(line, origin, normal);

        // test plane
        {
            const geometry = new THREE.PlaneGeometry( 10, 10 );
            const material = new THREE.MeshStandardMaterial( { color: 0xff0000, transparent: true, opacity: 0.2 } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, porigin);
            plane.lookAt(porigin.x + pnormal.x, porigin.y + pnormal.y, porigin.z + pnormal.z);
        }

        // test geometry
        const borigin = new THREE.Vector3(1, 0, 0);
        const bnormal = new THREE.Vector3(1, 0.4, 1).normalize();
        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0xaaaaaa } );
        const mesh = new THREE.Mesh( geometry, material );
        this.scene.add( mesh );
        this.setPos(mesh, borigin);
        mesh.lookAt(borigin.x + bnormal.x, borigin.y + bnormal.y, borigin.z + bnormal.z);

       const {length, vertices, intersections} = this.scene_math.intersectAABBPlane(mesh.geometry, mesh, porigin, pnormal);

        // debug draw
        for(let i in vertices) {
            this.testSphereAdd(vertices[i], 0.02, 0xeeeeee);
        }
        /*
        for(let i = 0; i < length; i++) {
            this.testSphereAdd(intersections[i], 0.07, 0xffff00);
        }*/
        const points_2d = this.scene_math.posOnPlaneArray(intersections, porigin, pnormal);
        for(let i = 0; i < length; i++) {
            this.testSphereAdd(new THREE.Vector3(points_2d[i].x, points_2d[i].y, 0), 0.03, 0xffff00);
        }

        // final test goal
        const box = this.scene_math.pointsToAabb2d(points_2d, length);

        // aabb plane
        {
            const geometry = new THREE.PlaneGeometry( box.max.x - box.min.x, box.max.y - box.min.y );
            const material = new THREE.MeshStandardMaterial( { color: 0x00ffff, wireframe: true } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, new THREE.Vector3((box.max.x + box.min.x) / 2, (box.max.y + box.min.y) / 2, 0));
            const planepos = (plane as any).position;
            plane.lookAt(planepos.x + pnormal.x, planepos.y + pnormal.y, planepos.z + pnormal.z);
        }

        //const bbox = new THREE.Box3().setFromObject(box)
        //box.geometry.computeBoundingBox();

    }

    /**
     * Testin line-plane intersections
     */
    test1() {
        const pointa = new THREE.Vector3(0, 0, 0);
        const pointb = new THREE.Vector3(0, 3, 3);
        const line = new THREE.Line3(pointa, pointb);
        const origin = new THREE.Vector3(0, 0, 0);
        const normal = new THREE.Vector3(0, 0, 1).normalize();
		const onplane = this.scene_math.intersectLinePlane(line, origin, normal);

        this.testSphereAdd(pointa, 0.1, 0xffff00);
        this.testSphereAdd(pointb, 0.1, 0xffff00);
        if(onplane) {
            this.testSphereAdd(onplane, 0.2, 0xff0000);
        }

        const geometry = new THREE.PlaneGeometry( 10, 10 );
        const material = new THREE.MeshBasicMaterial( { color: 0xaaaaaa } );
        const plane = new THREE.Mesh( geometry, material );
        this.scene.add( plane );
        this.setPos(plane, origin);
        plane.lookAt(origin.x + normal.x, origin.y + normal.y, origin.z + normal.z);
    }

    test2() {
        if(this._drawDebug2dAabb) {
            const geometry = new THREE.PlaneGeometry( 10, 10 );
            const material = new THREE.MeshStandardMaterial( { color: 0xaaaa00, transparent: true, opacity: 0.1 } );
            const plane = new THREE.Mesh( geometry, material as any );
            this.scene.add( plane );
            this.setPos(plane, this.colliders.origin)
            plane.lookAt(this.colliders.origin.x + this.colliders.normal.x, this.colliders.origin.y + this.colliders.normal.y, this.colliders.origin.z + this.colliders.normal.z);
        }

        {
            let groundbox = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(0, -1), new THREE.Vector2(1, 1));
            const groundbody = this.colliders.createBoxCollider("ground", groundbox);
            this.drawColliderDebug("ground", groundbody);
        }
        {
            let groundbox = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(2, -1), new THREE.Vector2(1, 1));
            const groundbody = this.colliders.createBoxCollider("ground2", groundbox);
            this.drawColliderDebug("ground2", groundbody);
        }
        let groundbox1 = new THREE.Box2().setFromCenterAndSize(new THREE.Vector2(-1.5, 0.5), new THREE.Vector2(1, 1));
        const groundbody1 = this.colliders.createBoxCollider("ground1", groundbox1);
        this.drawColliderDebug("ground1", groundbody1);
    }
}