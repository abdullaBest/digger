import { querySelector, EventListenerDetails, addEventListener, removeEventListeners, listenClick, popupListSelectMultiple, popupListSelect } from "../document";
import SceneEdit from "../scene_edit";
import { AssetsView, AssetPropertyEdit } from "./assets_view";
import SceneRender from "../scene_render";
import SceneMediator from "../scene_mediator";

export default class SceneEditView {
    list_container: HTMLElement;
    props_container: HTMLElement;
    scene_edit: SceneEdit;
    scene_render: SceneRender;
    scene_mediator: SceneMediator;
    private _listeners: Array<EventListenerDetails>;

    constructor(scene_edit: SceneEdit, scene_render: SceneRender, scene_mediator: SceneMediator){
        this.scene_edit = scene_edit;
        this.scene_render = scene_render;
        this.scene_mediator = scene_mediator;
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

        // select scene to edit
        addEventListener({name: "click", callback: async (ev) => {
            const id = (ev.target as HTMLElement).id;
            if(id) {
                try {
                    await this.scene_mediator.sceneSwitch(id);
                    this.propagate();
                } catch(err) {
                    console.error("SceneEditView: scene select error:", err)
                }
            }
        }, node: this.list_container}, this._listeners)

        // select scene element to edit
        addEventListener({name: "click", callback: async (ev) => {
            const el = (ev.target as HTMLElement);
            if(this.scene_edit.elements[el.id]) {
                el.classList.toggle('collapse');
                this.scene_render.attachTransformControls(el.id);
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

        // saves and returs to scene list
        listenClick("#back_to_scene_list_btn_save",  async (ev) => {
            this.closeScene(true);
        }, this._listeners)
        listenClick("#back_to_scene_list_btn_unsave",  async (ev) => {
            this.closeScene(false);
        }, this._listeners)

        // toggles modes of transform helper
        const tcontrols = this.scene_render.transform_controls
        listenClick("#controls_mode_transform_translate", () => tcontrols?.setMode( 'translate' ), this._listeners)
        listenClick("#controls_mode_transform_rotate", () => tcontrols?.setMode( 'rotate' ), this._listeners)
        listenClick("#controls_mode_transform_scale", () => tcontrols?.setMode( 'scale' ), this._listeners)
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
            (ev.target as HTMLElement).innerHTML = "t: " + mode_text;
        }, this._listeners)

        return this;
    }

    dispose() {
        removeEventListeners(this._listeners);
    }

    closeScene(save: boolean = false) {
        this.props_container.innerHTML = '';
        this.scene_render.clearModels();
        this.scene_render.clearTilesets();
        this.scene_render.clearTiggers();
        this.scene_edit.close(save);
        this.scene_render.colliders.clear();
    }

    removeElement(id: string) {
        this.scene_edit.removeElement(id);
        this.scene_render.removeModel(id);
        const htmlelement = this.props_container.querySelector('#' + id);
        if (htmlelement) {
            htmlelement.parentElement?.removeChild(htmlelement);
        }
    }

    cloneElement(id: string) {
        const el = this.scene_edit.cloneElement(id);
        this.draw(el.id);
    }

    /**
     * draws element in html and render
     * 
     * @param id element id
     * @param container html element to put data to
     */
    draw(id: string, container: HTMLElement = this.props_container) {
        const element = this.scene_edit.elements[id];

        const el = (container.querySelector('#' + id) || document.createElement('entry')) as HTMLLinkElement;
        el.id = element.id;
        el.dataset["name"] = element.name;
        el.classList.add("collapse");

        const props_container = document.createElement("container");
        props_container.classList.add("frame_background");
        el.appendChild(props_container);

        new AssetPropertyEdit().init(element, "name", () => {
            el.dataset["name"] = element.name;
        }).drawTextEditOption(el);

        if(element.components.model) {
            const redraw = () => {
                this.scene_render.removeModel(id);
                this.scene_render.addModel(id, element.components.model.properties);
            };
            redraw();
            AssetsView.drawModelPropertyFields(props_container, this.scene_edit.assets, element.components.model.properties, redraw)
        }

        if (element.components.tileset) {
            const redraw = () => {
                this.scene_render.removeTileset(id);
                this.scene_render.addTileset(id, element.components.tileset.properties);
            };
            redraw();
            AssetsView.drawTilesetPropertyFilelds(props_container, this.scene_edit.assets, element.components.tileset.properties, redraw)
        }

        if (element.components.trigger) {
            const redraw = () => {
                this.scene_render.removeElement(element.id);
                this.scene_render.addTriggerElement(element.id, element.components.trigger.properties);
            };
            redraw();
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
            this.draw(id);
        }
    }
}