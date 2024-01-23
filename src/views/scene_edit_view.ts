import { querySelector, EventListenerDetails, addEventListener, removeEventListeners, listenClick } from "../document";
import { popupListSelectMultiple, popupListSelect } from "../page/popup"
import SceneEdit, { SceneElement } from "../scene_edit";
import { AssetsView, AssetPropertyEdit } from "./assets_view";
import SceneRender from "../render/scene_render";
import SceneMediator from "../scene_mediator";
import SceneMap from "../scene_map";
import { SceneEditTools, SceneEditToolMode } from "../render/scene_edit_tools";
import { sendFiles } from "../assets";

export default class SceneEditView {
    list_container: HTMLElement;
    props_container: HTMLElement;
    scene_edit: SceneEdit;
    scene_render: SceneRender;
    scene_edit_tools: SceneEditTools;
    scene_mediator: SceneMediator;
    scene_map: SceneMap;
    private _listeners: Array<EventListenerDetails>;

    constructor(scene_edit: SceneEdit, scene_render: SceneRender, scene_edit_tools: SceneEditTools, scene_mediator: SceneMediator, scene_map: SceneMap){
        this.scene_edit = scene_edit;
        this.scene_render = scene_render;
        this.scene_mediator = scene_mediator;
        this.scene_map = scene_map;
        this.scene_edit_tools = scene_edit_tools;
    }

    /**
     * 
     * @param list_container container lists all scenes from assets
     * @param props_container container list all scene elements
     * @returns 
     */
    init(list_container: HTMLElement | null, props_container: HTMLElement | null) : SceneEditView {
        if(!list_container) throw new Error("SceneEditView init error: argument list_container is null");
        if(!props_container) throw new Error("SceneEditView init error: argument props_container is null");

        this.list_container = list_container;
        this.props_container = props_container;

        addEventListener({name: "scene_open", callback: async (ev) => {
            this.propagate();
        }, node: this.scene_mediator.events}, this._listeners)

        addEventListener({name: "scene_close", callback: async (ev) => {
            this.scene_edit_tools.tileset_editor.cleanup();
           
        }, node: this.scene_mediator.events}, this._listeners);

        // select scene to edit
        addEventListener({name: "click", callback: async (ev) => {
            const id = (ev.target as HTMLElement).id;
            if(id) {
                try {
                    await this.scene_mediator.sceneSwitch(id);
                } catch(err) {
                    console.error("SceneEditView: scene select error:", err)
                }
            }
        }, node: this.list_container}, this._listeners)

        // select scene element to edit
        addEventListener({name: "click", callback: async (ev) => {
            const el = (ev.target as HTMLElement);
            const scene_element = this.scene_edit.elements[el.id];
            if(scene_element) {
                el.classList.toggle('collapse');
                this.scene_edit_tools.attachTransformControls(el.id);
                if (scene_element.components.tileset) {
                    
                    this.scene_edit_tools.tileset_editor.drawPalette(this.scene_map.tilesets[el.id]);
                }
            } else {
                // element actions
                const id = el.parentElement?.dataset["elementid"];
                if (id && this.scene_edit.elements[id]) {
                    switch(el.id) {
                        case "delete":
                            this.removeElement(id);
                            break;
                        case "clone":
                            this.cloneElement(id);
                            break;
                    }
                }
            }
        }, node: this.props_container}, this._listeners);

        // adds new movel to scene
        // todo: mode to scene_edit
        listenClick("#add_scene_model_btn",  async (ev) => {
            const popupel = document.querySelector("container#popup_content") as HTMLElement;
            if (!popupel) {
                throw new Error("can't draw popup");
            }
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'model'}, '');
            const modelids = await popupListSelectMultiple("select model(s)");
            for(const i in modelids) {
                const modelid = modelids[i];
                const modelasset = this.scene_edit.assets.get(modelid);
                const el = await this.scene_edit.addElement({model: modelid, name: modelasset?.info.name});
                this.draw(el.id);
            }
        }, this._listeners)

        listenClick("#add_scene_tileset_btn",  async (ev) => {
            const popupel = querySelector("container#popup_content") as HTMLElement;
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'tileset'}, '');
            const tilesetid = await popupListSelect("select model(s)");
            const tilesetasset = this.scene_edit.assets.get(tilesetid);
            const el = await this.scene_edit.addElement({tileset: tilesetid, name: tilesetasset?.info.name});
            this.draw(el.id);
        }, this._listeners)

        listenClick("#add_scene_trigger_btn",  async (ev) => {
            const el = await this.scene_edit.addElement({trigger: { type: "not defined", signal: "unset", width: 1, height: 1 }});
            this.draw(el.id);
        }, this._listeners)

        listenClick("#add_scene_mapentry_btn",  async (ev) => {
            const el = await this.scene_edit.addElement({trigger: { type: "mapentry", signal: "unset", width: 1, height: 1 }});
            this.draw(el.id);
        }, this._listeners)

        listenClick("#add_scene_mapexit_btn",  async (ev) => {
            const el = await this.scene_edit.addElement({trigger: { type: "mapexit", signal: "unset", width: 1, height: 1 }});
            this.draw(el.id);
        }, this._listeners)

        // saves and returs to scene list
        listenClick("#back_to_scene_list_btn_save",  async (ev) => {
            for(const k in this.scene_edit_tools.tileset_editor.changed_tilesets) {
                this.saveTileset(k);
            }
            this.closeScene(true);
        }, this._listeners)
        listenClick("#back_to_scene_list_btn_unsave",  async (ev) => {
            this.closeScene(false);
        }, this._listeners)


        const set_edit_mode = (mode: SceneEditToolMode) => {
            this.scene_edit_tools.setEditMode(mode);
            switch (mode) {
                case SceneEditToolMode.DEFAULT:
                    break;
                case SceneEditToolMode.TRANSLATE:
                    break;
                case SceneEditToolMode.ROTATE:
                    break;
                case SceneEditToolMode.SCALE:
                    break;
                case SceneEditToolMode.TILE_DRAW:
                    break;
                case SceneEditToolMode.TILE_ERASE:
                    break;
            }
        }

        const edit_modes_elements = {
            [SceneEditToolMode.TRANSLATE]: querySelector("#controls_mode_transform_translate"),
            [SceneEditToolMode.ROTATE]: querySelector("#controls_mode_transform_rotate"),
            [SceneEditToolMode.SCALE]: querySelector("#controls_mode_transform_scale"),
            [SceneEditToolMode.TILE_DRAW]: querySelector("#controls_mode_draw_tiles"),
            [SceneEditToolMode.TILE_ERASE]: querySelector("#controls_mode_erase_tiles"),
        }

        const addModeBtnListener = (mode: SceneEditToolMode) => {
            const el = edit_modes_elements[mode];
            listenClick(el, () => {
                set_edit_mode(mode);
                for(const i in edit_modes_elements) {
                    edit_modes_elements[i].classList.remove("highlighted");
                }
                el.classList.add("highlighted");
            }, this._listeners);
        }

        addModeBtnListener(SceneEditToolMode.TRANSLATE);
        addModeBtnListener(SceneEditToolMode.ROTATE);
        addModeBtnListener(SceneEditToolMode.SCALE);
        addModeBtnListener(SceneEditToolMode.TILE_DRAW);
        addModeBtnListener(SceneEditToolMode.TILE_ERASE);
        // toggles modes of transform helper
        const tcontrols = this.scene_edit_tools.transform_controls

        listenClick("#controls_mode_transform_toggle_snap", (ev) => { 
            let tsnap: number | null = 1;
            let rsnap: number | null = 15 * Math.PI / 180;
            let ssnap: number | null = 0.25;
            if (!(ev.target as HTMLElement)?.classList.toggle("highlighted")) {
                tsnap = rsnap = ssnap = null;
            }
            tcontrols.setTranslationSnap( tsnap );
            tcontrols.setRotationSnap( rsnap );
            tcontrols.setScaleSnap( ssnap );
        }, this._listeners )
        listenClick("#controls_mode_transform_toggle_world", (ev) =>  {
            const mode_local = (ev.target as HTMLElement)?.classList.toggle("highlighted")
            const mode_text = mode_local ? 'local'  : 'world'
            tcontrols.setSpace( mode_text );
            //(ev.target as HTMLElement).innerHTML = "t: " + mode_text;
        }, this._listeners)


        tcontrols.addEventListener( 'objectChange', (e) => {
            const object = e.target.object;
            const id = object.name;
            this.scene_map.updateEntityCollider(id);
            const el = this.scene_edit.elements && this.scene_edit.elements[id];

            // only works with scene edit elements
            if (!el) {
                return;
            }

            let properiesa =  el.components.trigger?.properties;
            let properiesb = el.components.model?.properties;
            if (el && properiesa) {
                const pos_x = (object as any).position.x;
                const pos_y = (object as any).position.y;
                properiesa.pos_x = pos_x;
                properiesa.pos_y = pos_y;
            } else if (properiesb) {
                properiesb.matrix = object.matrixWorld.toArray()
            } 
        });

        tcontrols.addEventListener( 'object-changed',  ( e ) => {
            const object = e.target.object;
            if (!object) {
                return;
            }
            const id = object.name;
            const entity = this.scene_map.entities[id];
            if (id) {
                console.log("selected entity " + id, entity);
            }
        });

        tcontrols.addEventListener( 'mouseUp',  ( e ) => {
            const object = e.target.object;
            const id = object.name;
            this.scene_map.updateEntityCollider(id);
            const el = this.scene_edit.elements && this.scene_edit.elements[id];
            if (!el) {
                return;
            }

            // redraw tileset
            let properiesa = el.components.tileset?.properties;
            if (properiesa) {
                const pos_x = (object as any).position.x;
                const pos_y = (object as any).position.y;
                properiesa.pos_x = pos_x;
                properiesa.pos_y = pos_y;
                this.redrawElement(el);
            }
        } );

        return this;
    }

    /**
     * saves new tileset image
     * 
     * @param id tileset id
     */
    saveTileset(id: string) {
        const tileset = this.scene_map.tilesets[id];
        const image_asset = this.scene_edit.assets.get(tileset.tileset.texture);
        const image_file = tileset.image;
        if (!image_file) {
            return;
        }

        // is it possible to send files without canvas?
        const canvas = tileset.canvas;
        const image = tileset.image;
        const ctx = canvas.getContext("2d");
        if (!canvas || !image || !ctx) {
            return;
        }
        
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0);
        canvas.toBlob(async (blob) => {
            if (!blob || !image_asset) {
                return;
            }
            const file = new File([blob], image_asset.info.id, {
                type: image_asset.info.type,
            });

            await sendFiles("/assets/upload/" + image_asset.info.id, [file]);
            this.scene_edit.assets.loadAsset(image_asset.info.id);
        });
    }

    dispose() {
        removeEventListeners(this._listeners);
    }

    closeScene(save: boolean = false) {
        this.scene_mediator.sceneClose();
        this.props_container.innerHTML = '';
        this.scene_edit.close(save);
    }

    removeElement(id: string) {
        this.scene_edit.removeElement(id);
        this.scene_map.removeEntity(id);
        const htmlelement = this.props_container.querySelector('#' + id);
        if (htmlelement) {
            htmlelement.parentElement?.removeChild(htmlelement);
        }
    }

    cloneElement(id: string) {
        const el = this.scene_edit.cloneElement(id);
        this.draw(el.id);
    }

    async redrawElement(element: SceneElement) {
        await this.scene_map.addElement(element);

        if (element.components.tileset) {
            this.scene_mediator.scene_game.tileset_render.cleanup();
            this.scene_mediator.scene_game.tileset_render.update(0, 0);
            this.scene_edit_tools.tileset_editor.drawPalette(this.scene_map.tilesets[element.id]);
        }
    }

    /**
     * draws element in html and render
     * 
     * @param id element id
     * @param inrender redraws model in 3d view
     * @param container html element to put data to
     */
    draw(id: string, inrender: boolean = true, container: HTMLElement = this.props_container) {
        const element = this.scene_edit.elements[id];

        const el = (container.querySelector('#' + id) || document.createElement('entry')) as HTMLLinkElement;
        el.id = element.id;
        el.dataset["name"] = element.name;
        el.classList.add("collapse");

        const props_container = document.createElement("container");
        props_container.classList.add("frame_background");
        props_container.classList.add("flex-table");
        el.appendChild(props_container);

        new AssetPropertyEdit().init(element, "name", () => {
            el.dataset["name"] = element.name;
        }).drawTextEditOption(el);

        const redraw = async () => {
            this.redrawElement(element);
        };
        if (inrender) {
            redraw();
        }

        if(element.components.model) {
            AssetsView.drawModelPropertyFields(props_container, this.scene_edit.assets, element.components.model.properties, redraw)
        }

        if (element.components.tileset) {
            AssetsView.drawTilesetPropertyFilelds(props_container, this.scene_edit.assets, element.components.tileset.properties, redraw)
        }

        if (element.components.trigger) {
            AssetsView.drawTriggerPropertyFields(props_container, this.scene_edit.assets, element.components.trigger.properties, redraw)
        }

        if (!el.querySelector("controls")) {
            const c = document.createElement("controls");
            c.dataset["elementid"] = id;
            c.innerHTML = "<btn id='delete'>delete</btn><btn id='clone'>clone</btn>"
            c.classList.add("small", "padded", "scene_element_controls");
            el.appendChild(c);
        }

        container.appendChild(el);
    }

    /**
     * draw list of all scene elements in html and 3d view. SceneEdit has to be loaded
     */
    propagate(container: HTMLElement = this.props_container) {
        container.innerHTML = '';

        for(const id in this.scene_edit.elements) {
            const element = this.scene_edit.elements[id];
            this.draw(id, false);
        }
    }
}