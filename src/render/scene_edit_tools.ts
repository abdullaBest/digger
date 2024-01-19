import * as THREE from '../lib/three.module.js';
import { TransformControls } from '../lib/TransformControls.js';
import SceneCollisions from '../scene_collisions.js';
import SceneRender from './scene_render.js';
import TilesetEditor from './tileset_editor.js';
import { setObjectPos } from './render_utils.js';
import { snap } from '../math.js';
import { SceneMap, MapComponent, MapEntity } from '../scene_map.js';

enum SceneEditToolMode {
    DEFAULT = 0,
    TRANSLATE = 1,
    ROTATE = 2,
    SCALE = 3,
    TILE_DRAW = 4,
    TILE_ERASE = 5
}

class SceneEditTools {
    /**
     * Relative screen coords (-1;1)
     */
    private mousepos: THREE.Vector2;
    private mousepos_abs: THREE.Vector2;
    private mousepressed: boolean;
    private mousepos_world: THREE.Vector3;

    transform_controls: TransformControls;
    private raycaster: THREE.Raycaster;

    scene_render: SceneRender;
    tileset_editor: TilesetEditor;
    scene_collisions: SceneCollisions;
    scene_map: SceneMap;

    editmode: SceneEditToolMode;

    private cube: THREE.Mesh;

    constructor(scene_render: SceneRender, scene_collisions: SceneCollisions, scene_map: SceneMap) {
        this.scene_render = scene_render;
        this.scene_collisions = scene_collisions;
        this.scene_map = scene_map;

        this.mousepos = new THREE.Vector2();
        this.mousepos_world = new THREE.Vector3();
        this.mousepos_abs = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.mousepressed = false;
        this.tileset_editor = new TilesetEditor(this.scene_render.loader);
        this.editmode = SceneEditToolMode.DEFAULT;
    }

    init() {
        this.tileset_editor.init();

        const geometry = new THREE.BoxGeometry( 1, 1, 1 );
        const material = new THREE.MeshBasicMaterial( { color: 0x00ff00, transparent: true, opacity: 0.7 } );
        const cube = new THREE.Mesh( geometry, material );
        this.scene_render.scene.add( cube );
        cube.visible = false;
        this.cube = cube;

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
            this.mousepressed = true;
        });
        this.scene_render.canvas.addEventListener('mouseup', (ev: MouseEvent) => {
            const deltax = Math.abs(ev.clientX - localMouse.x);
            const deltay = Math.abs(ev.clientY - localMouse.y);
            if (deltax + deltay < 10) {
                this.onMouseClick(ev);
            }
            this.mousepressed = false;
            this.scene_render.controls.enableRotate = true;
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

        if (this.mousepressed) {
        }

        this.raycaster.setFromCamera( this.mousepos, this.scene_render.camera );
        const pos = this.scene_render.scene_math.intersectRayPlane(this.raycaster.ray.origin, this.raycaster.ray.direction, this.scene_collisions.origin, this.scene_collisions.normal); //cache.vec3_0
        if (pos) {
            pos.x = snap(pos.x, this.tileset_editor.tilesize_x);
            pos.y = snap(pos.y, this.tileset_editor.tilesize_y)
            this.mousepos_world.copy(pos);
        }
        if (pos && this.isInTileEditMode()) {
            setObjectPos(this.cube, pos);
        }
    }

    onMouseClick( event ) {
        event.preventDefault();
        
        // pick sidebar
        const sidebar_box = this.getSidebarSize();
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
                this.tileset_editor.camera, 
                this.tileset_editor.scene.children, 
                this.tileset_editor.objects);
            if (object) {
                this.tileset_editor.pickObject(object.name);
            }

            return;
        }

        if (this.editmode == SceneEditToolMode.TRANSLATE || this.editmode == SceneEditToolMode.ROTATE || this.editmode == SceneEditToolMode.SCALE) {
            // pick on scene
            const object = this.pickObject(this.mousepos, this.scene_render.camera, this.scene_render.scene.children, this.scene_render.cache.objects);

            if ( object ) {
                console.log("transform attached to " + object.name)
                this.transform_controls.attach(object);
            }
        } else if (this.isInTileEditMode()) {
            this.tilesetDraw();
        }
    }

    tilesetDraw() {
        const drawobject = this.tileset_editor.slected_object;
        if (!drawobject || !this.tileset_editor.selected_tileset) {
            return;
        }

        const pos_x = this.mousepos_world.x;
        const pos_y = this.mousepos_world.y;
        const tileset = this.scene_map.tilesets[this.tileset_editor.selected_tileset];
        const drawid = drawobject.name;
        let drawcolor = this.tileset_editor.colors[drawid];
        if (this.editmode == SceneEditToolMode.TILE_ERASE) {
            drawcolor = tileset.tileset.zero_color;
        }
        const drawmodel = tileset.models[drawid];
        const newid = tileset.makeTileId(pos_x, pos_y);

        if (this.editmode == SceneEditToolMode.TILE_DRAW) {
            const entity = new MapEntity(newid);
            // tynroar todo: make proper inheritance insead of ref_id
            entity.inherits = drawid;
            const model = Object.setPrototypeOf({ pos_x, pos_y }, drawmodel);
            entity.components.model = new MapComponent(model);
            this.scene_map.addEntity(entity);
        } else if (this.editmode == SceneEditToolMode.TILE_ERASE) {
            this.scene_map.removeEntity(newid);
        }

        const canvas = tileset.canvas;
        const image = tileset.image;
        const ctx = canvas.getContext("2d");

        if (canvas && image && ctx) {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0);
            ctx.rect(pos_x, pos_y, 1, 1);
            ctx.fillStyle = drawcolor;
            ctx.fill();
            image.src = canvas.toDataURL();
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

        this.tileset_editor.step(dt);
    }

    render() {
        // render ui
        this.scene_render.renderer.clearDepth();
        const sidebar_size = this.getSidebarSize();
        this.scene_render.renderer.setViewport(
            sidebar_size.min.x,
            sidebar_size.min.y,
            sidebar_size.max.x - sidebar_size.min.x,
            sidebar_size.max.y - sidebar_size.min.y
        );
        this.scene_render.renderer.autoClear = false;
        this.scene_render.renderer.render(this.tileset_editor.rootscene, this.tileset_editor.camera);
        this.scene_render.renderer.autoClear = true;
    }

    getSidebarSize() {
        const padding = 16;

        const width = this.scene_render.getRenderWidth();
        const height = this.scene_render.getRenderHeight();
        const box = this.scene_render.cache.box2_0;

        box.max.x = width - padding;
        box.min.x = box.max.x - this.tileset_editor.palette_w * (height / this.tileset_editor.palette_h);;
        box.min.y = padding;
        box.max.y = height - padding;

        return box;
    }

    setEditMode(mode: SceneEditToolMode) {
        this.editmode = mode;
        this.cube.visible = false;
        this.transform_controls.visible = true;
        switch (mode) {
            case SceneEditToolMode.DEFAULT:
                break;
            case SceneEditToolMode.TRANSLATE:
                this.transform_controls?.setMode( 'translate' )
                break;
            case SceneEditToolMode.ROTATE:
                this.transform_controls?.setMode( 'rotate' )
                break;
            case SceneEditToolMode.SCALE:
                this.transform_controls?.setMode( 'scale' )
                break;
            case SceneEditToolMode.TILE_DRAW:
                this.transform_controls.visible = false;
                this.cube.visible = true;
                this.cube.material.color.set(0, 1, 0);
                break;
            case SceneEditToolMode.TILE_ERASE:
                this.transform_controls.visible = false;
                this.cube.material.color.set(1, 0, 0);
                this.cube.visible = true;
                break;
        }
    }

    isInTileEditMode() {
        return this.editmode == SceneEditToolMode.TILE_DRAW || this.editmode == SceneEditToolMode.TILE_ERASE;
    }
}

export { SceneEditToolMode, SceneEditTools }
export default SceneEditTools;