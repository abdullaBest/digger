import * as THREE from './lib/three.module.js';

class SceneMathCache {
    vec2_0: THREE.Vector2;
    vec3_0: THREE.Vector3;
    vec3_1: THREE.Vector3;
    vec3_2: THREE.Vector3;
    vec3_3: THREE.Vector3;
    vec3_4: THREE.Vector3;
    line3_0: THREE.Line3;
    vertices: Array<THREE.Vector3>;
    points: Array<THREE.Vector3>;
    points_2d: Array<THREE.Vector2>;
    constructor() {
        this.vec2_0 = new THREE.Vector2();
        this.vec3_0 = new THREE.Vector3();
        this.vec3_1 = new THREE.Vector3();
        this.vec3_2 = new THREE.Vector3();
        this.vec3_3 = new THREE.Vector3();
        this.vec3_4 = new THREE.Vector3();
        this.line3_0 = new THREE.Line3();
        this.vertices = Array.apply(null,{length: 16}).map(function() { return new THREE.Vector3(); });
        this.points = Array.apply(null,{length: 16}).map(function() { return new THREE.Vector3(); });
        this.points_2d = Array.apply(null,{length: 16}).map(function() { return new THREE.Vector2(); });
    }
}

const AABB_EDGES = [
    [0, 1],
    [0, 2],
    [0, 3],
    [2, 4],
    [3, 4],
    [1, 5],
    [2, 5],
    [1, 6],
    [3, 6],
    [4, 7],
    [5, 7],
    [6, 7]
]

/**
 * Caution. All return values are cached! 
 */
export default class SceneMath {
    private cache: SceneMathCache;
    constructor() {
        this.cache = new SceneMathCache();
    }
    /**
     * looks kinda not working
     * @param point 
     * @param origin 
     * @param normal 
     * @returns 
     */
    projectPointOnPlane(point: THREE.Vector3, origin: THREE.Vector3, normal: THREE.Vector3) : THREE.Vector3 {
        const vec0 = this.cache.vec3_0;
        const vec1 = this.cache.vec3_1;
        const vec2 = this.cache.vec3_2;
        const vec3 = this.cache.vec3_3;

        const local = vec3.copy(point).sub(origin);
        const forward = vec1.copy(normal).cross(local).normalize();
        const right = vec2.copy(normal).cross(forward).normalize();
    
        const x = local.dot(right);
        const z = local.dot(forward);
    
        return vec0.copy(origin).add(right.multiplyScalar(x)).add(forward.multiplyScalar(z));
    }

    /**
     * @param point ray origin
     * @param direction ray direction
     * @param origin plane origin
     * @param normal plane normal
     * @returns 
     */
    intersectRayPlane(point: THREE.Vector3, direction: THREE.Vector3, origin: THREE.Vector3, normal: THREE.Vector3, ) : THREE.Vector3 | null
    {
        const vec0 = this.cache.vec3_0;
        const vec1 = this.cache.vec3_1;

        const d1 = -origin.dot(normal);
        const d2 = direction.dot(normal)
        if (Math.abs(d2) <= 1e-4) {
            return null;
        }

        let t = -(d1 + point.dot(normal)) / d2;
        if (t <= -1e-4) {
            return null;
        }
        return vec0.copy(point).add(vec1.copy(direction).multiplyScalar(t));
    }

    intersectLinePlane(line: THREE.Line3, origin: THREE.Vector3, normal: THREE.Vector3) :  THREE.Vector3 | null {
        const vec1 = this.cache.vec3_3;

        const line_norm = vec1.copy(line.end).sub(line.start).normalize();
        const intersect = this.intersectRayPlane(line.start, line_norm, origin, normal); //cache.vec3_0
        if (!intersect || line.start.distanceTo(intersect) > line.start.distanceTo(line.end)) {
            return null;
        }
        
        return intersect;
    }

    /**
     * 
     * @param mesh Mesh to find bounding box intersections with
     * @param origin plane origin
     * @param normal plane normal
     */
    intersectAABBPlane(mesh: THREE.Mesh, origin: THREE.Vector3, normal: THREE.Vector3) : { length: number, intersections: Array<THREE.Vector3>, vertices: Array<THREE.Vector3> } {
         // geometry transformed bound box
        mesh.geometry.computeBoundingBox();
        mesh.updateMatrixWorld();
        const box = new THREE.Box3().copy( mesh.geometry.boundingBox );
        const vertices = this.cache.vertices;
        vertices[0].set(box.min.x, box.min.y, box.min.z).applyMatrix4(mesh.matrixWorld);
        vertices[1].set(box.max.x, box.min.y, box.min.z).applyMatrix4(mesh.matrixWorld);
        vertices[2].set(box.min.x, box.max.y, box.min.z).applyMatrix4(mesh.matrixWorld);
        vertices[3].set(box.min.x, box.min.y, box.max.z).applyMatrix4(mesh.matrixWorld);
        vertices[4].set(box.min.x, box.max.y, box.max.z).applyMatrix4(mesh.matrixWorld);
        vertices[5].set(box.max.x, box.max.y, box.min.z).applyMatrix4(mesh.matrixWorld);
        vertices[6].set(box.max.x, box.min.y, box.max.z).applyMatrix4(mesh.matrixWorld);
        vertices[7].set(box.max.x, box.max.y, box.max.z).applyMatrix4(mesh.matrixWorld);
 
        // calculate plane intersections
        let intersections = this.cache.points;
        let length = 0;
        let line = new THREE.Line3();
        for(let i in AABB_EDGES) {
            const edge = AABB_EDGES[i];
            line.set(vertices[edge[0]], vertices[edge[1]]);
            let intersect = this.intersectLinePlane(line, origin, normal);
            if (intersect) {
                intersections[length++].copy(intersect);
            } 
        }
 
        return { length, intersections, vertices }
    }

    intersectAABBPlaneTo2dAabb(mesh: THREE.Mesh, origin: THREE.Vector3, normal: THREE.Vector3) : THREE.Box2 {
        const {length, vertices, intersections} = this.intersectAABBPlane(mesh, origin, normal);
        const points_2d = this.posOnPlaneArray(intersections, origin, normal);
        const box = this.pointsToAabb2d(points_2d, length);

        return box;
    }

    posOnPlaneArray(points: Array<THREE.Vector3>, origin: THREE.Vector3, normal: THREE.Vector3, size: number = points.length) : Array<THREE.Vector2> {
        for(let i = 0; i < size; i++) {
            const p2 = this.posOnPlane(points[i], origin, normal);
            this.cache.points_2d[i].copy(p2);
        }

        return this.cache.points_2d;
    }

    pointsToAabb2d(points: Array<THREE.Vector2>, size: number = points.length) : THREE.Box2 {
        const box = new THREE.Box2();
        for (let i = 0; i < size; i++) {
            box.min.min(points[i]);
            box.max.max(points[i]);
        }

        return box;
    }

    /**
     * @param point point world position
     * @param origin plane world position
     * @param normal plane normal
     * @returns local 2d plane position
     */
    posOnPlane(point: THREE.Vector3, origin: THREE.Vector3, normal: THREE.Vector3) : THREE.Vector2 {
        const axis = this.cache.vec3_1.set(0, 1, 0);
        const dist = this.cache.vec3_2.copy(point).sub(origin);
        const v = this.cache.vec3_3;
        const u = this.cache.vec3_4;
    
        const dot = normal.dot(axis);
        console.log(dot)
        if (dot === 0 || Math.abs(dot) === 1) {
            v.set(0, 1, 0);
            u.set(1, 0, 0);
        } else {
            v.copy(axis).cross(normal).normalize();
            u.copy(v).cross(normal).normalize();
        }
    
        const x = dist.dot(u);
        const y = dist.dot(v);
    
        return this.cache.vec2_0.set(x, y);
    }
}
