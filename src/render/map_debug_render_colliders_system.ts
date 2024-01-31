import { MapSystem } from "../systems";
import { SceneCollisions, BoxColliderC, ColliderType } from "../scene_collisions";
import SceneRender from "./scene_render";
import { AssetContentTypeComponent, AssetContentTypeModel } from '../assets';
import * as THREE from '../lib/three.module.js';

export default class MapDebugRenderCollidersSystem extends MapSystem {
    private scene_render: SceneRender;
    private scene_collisions: SceneCollisions;
    private debug_colliders: { [id: string]: THREE.Object3D };

    constructor(scene_collisions: SceneCollisions, scene_render: SceneRender) {
        super();
        this.priority = -1;
        this.scene_collisions = scene_collisions;
        this.scene_render = scene_render;
        this.debug_colliders = {};
    }

    filter(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) : boolean {
        return component.type == "collider";
    }

    async add(component: AssetContentTypeModel, owner?: AssetContentTypeComponent) {
        if (!this.filter(component, owner)) {
            return;
        }

        const collider = this.scene_collisions.colliders[component.id];
        if (!collider) {
            console.warn(`MapDebugRenderCollidersSystem::add error - no object ${component.id} registered.`);
        }
        this.drawColliderDebug(component.id, collider);

    }

    remove(component: AssetContentTypeModel) {
        if (!this.debug_colliders[component.id]) {
            return;
        }
        this.scene_render.removeObject(component.id + '-dbg_collider')
        delete this.debug_colliders[component.id];
    }

    drawColliderDebug(id: string, collider: BoxColliderC, color?: number, shift?: THREE.Vector2) {
        let plane = this.debug_colliders[id];
        color = color ?? collider.type == ColliderType.RIGID ? 0x00ffff : 0xff00ff;

        if (!plane) {
            const geometry = new THREE.PlaneGeometry( 1, 1 );
            // tynroar tmp todo: move material into cache
            const material = new THREE.MeshStandardMaterial( { color, wireframe: true } );
            plane = new THREE.Mesh( geometry, material as any );
            this.scene_render.addObject(id + '-dbg_collider', plane)
        }

        let shift_x = 0;
        let shift_y = 0;
        if (shift) {
            shift_x = shift.x;
            shift_y = shift.y;
        }

        this.scene_render.setPos(plane, new THREE.Vector3(collider.x + shift_x, collider.y + shift_y, this.scene_collisions.origin.z))
        const planepos = (plane as any).position;
        (plane as any).scale.set(collider.width, collider.height, 1);
        plane.lookAt(planepos.x + this.scene_collisions.normal.x, planepos.y + this.scene_collisions.normal.y, this.scene_collisions.origin.z + this.scene_collisions.normal.z);
        this.debug_colliders[id] = plane;
    }

    step(dt: number): void {
        for (const k in this.scene_collisions.bodies) {
            const body = this.scene_collisions.bodies[k];
            if (this.debug_colliders[k]) {
                this.drawColliderDebug(k, body.collider);
            }
        }
    }
}