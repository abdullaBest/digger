import * as THREE from '../lib/three.module.js';
import { TransformControls } from '../lib/TransformControls.js';
import SceneRender from './scene_render.js';

export default class SceneEditTools {
    /**
     * Relative screen coords (-1;1)
     */
    private mousepos: THREE.Vector2;
    private mousepos_abs: THREE.Vector2;
    private mousepressed: boolean;

    transform_controls: TransformControls;
    private raycaster: THREE.Raycaster;

    scene_render: SceneRender;

    constructor(scene_render: SceneRender) {
        this.mousepos = new THREE.Vector2();
        this.mousepos_abs = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.scene_render = scene_render;
        this.mousepressed = false;
    }

    init() {
        this.transform_controls = new TransformControls( this.scene_render.camera, this.scene_render.renderer.domElement );
        this.transform_controls.addEventListener( 'mouseDown', ( event ) => {
            this.scene_render.controls.enabled = false;
        } );
        this.transform_controls.addEventListener( 'mouseUp',  ( event ) => {
            this.scene_render.controls.enabled = true;
        } );
        this.scene_render.rootscene.add(this.transform_controls);

        let localMouse = {x: 0, y: 0}
        this.scene_render.canvas.addEventListener('mousedown', (ev: MouseEvent) => {
            localMouse.x = ev.clientX;
            localMouse.y = ev.clientY;
            this.mousepressed = false;
        });
        this.scene_render.canvas.addEventListener('mouseup', (ev: MouseEvent) => {
            const deltax = Math.abs(ev.clientX - localMouse.x);
            const deltay = Math.abs(ev.clientY - localMouse.y);
            if (deltax + deltay < 10) {
                this.onMouseClick(ev);
            }
            this.mousepressed = true;
        });

        this.scene_render.canvas.addEventListener('mousemove', (ev: MouseEvent) => {
            this.onMouseMove(ev);
        });
    }

    
    pickObject(pos: THREE.Vector2, camera: THREE.Camera, nodes: Array<THREE.Object3D>, list: { [id: string] : THREE.Object3D }) : THREE.Object3D | null {
        this.raycaster.setFromCamera( pos, camera );
        const intersects = this.raycaster.intersectObjects( nodes, true );

        let object: THREE.Object3D | null = null;
        for(const i in intersects) {
            const intersect = intersects[i];
            let o = intersect.object;
            while(o) {
                if (list[o.name]) {
                    object = o;
                    break;
                }
                o = o.parent;
            } 
            if (object) {
                break;
            }
        }

        return object;
    }

    onMouseMove(ev) {
        const event = ev as any;
        event.preventDefault();

        this.mousepos_abs.x = event.layerX;
        this.mousepos_abs.y = event.layerY;
        this.mousepos.x = ( event.layerX / event.target.offsetWidth ) * 2 - 1;
        this.mousepos.y = - ( event.layerY / event.target.offsetHeight ) * 2 + 1;
    }

    onMouseClick( event ) {
        event.preventDefault();
        
        // pick sidebar
        const sidebar_box = this.scene_render.getSidebarSize();
        if (sidebar_box.containsPoint(this.mousepos_abs)) {
            const x = this.mousepos_abs.x - sidebar_box.min.x;
            const y = this.mousepos_abs.y - sidebar_box.min.y;
            this.mousepos.x = ( event.layerX / event.target.offsetWidth ) * 2 - 1;
            this.mousepos.y = - ( event.layerY / event.target.offsetHeight ) * 2 + 1;
            const size = sidebar_box.getSize(this.scene_render.cache.vec2_0);
            const rx = (x / size.x) * 2 - 1
            const ry = -(y / size.y) * 2 + 1
            const object = this.pickObject(
                this.scene_render.cache.vec2_0.set(rx, ry), 
                this.scene_render.tileset_editor.camera, 
                this.scene_render.tileset_editor.scene.children, 
                this.scene_render.tileset_editor.objects);
            if (object) {
                this.scene_render.tileset_editor.pickObject(object.name);
            }

            return;
        }

        // pick on scene
        const object = this.pickObject(this.mousepos, this.scene_render.camera, this.scene_render.scene.children, this.scene_render.cache.objects);

        if ( object ) {
            console.log("transform attached to " + object.name)
            this.transform_controls.attach(object);
        }
    }
    
    /**
     * 
     * @param id model id
     */
    attachTransformControls(id: string) {
        const object = this.scene_render.cache.objects[id];
        if (object) {
            this.transform_controls.attach(object);
        }
    }

    step(dt: number) {
        if (this.transform_controls.object && !this.transform_controls.object.parent) {
            this.transform_controls.detach();
        }
    }
}