import { popupListSelect, listenClick } from "../document";
import SceneEdit from "../scene_edit";
import AssetsView from "./assets_view";
import SceneRender from "../scene";

export default class SceneEditView {
    list_container: HTMLElement;
    props_container: HTMLElement;
    scene_edit: SceneEdit;
    scene_render: SceneRender;

    constructor(scene_edit: SceneEdit, scene_render: SceneRender){
        this.scene_edit = scene_edit;
        this.scene_render = scene_render;
    }

    init(list_container: HTMLElement | null, props_container: HTMLElement | null) : SceneEditView {
        if(!list_container) throw new Error("SceneEditView init error: argument list_container is null");
        if(!props_container) throw new Error("SceneEditView init error: argument props_container is null");

        this.list_container = list_container;
        this.props_container = props_container;

        this.list_container.addEventListener('click', async (ev) => {
            const id = (ev.target as HTMLElement).id;
            if(id) {
                await this.scene_edit.load(id);
                this.propagate();
            }
        });
        this.props_container.addEventListener('click', async (ev) => {
            const id = (ev.target as HTMLElement).id;
            if(this.scene_edit.elements[id]) {
                (ev.target as HTMLElement).classList.toggle('collapse');
            }
        });

        listenClick("#add_scene_model_btn",  async (ev) => {
            const popupel = document.querySelector("container#popup_content") as HTMLElement;
            if (!popupel) {
                throw new Error("can't draw popup");
            }
            AssetsView.propagate(this.scene_edit.assets, popupel, {extension: 'model'}, '');
            const modelid = await popupListSelect("select model");
            const modelasset = this.scene_edit.assets.get(modelid);
            const el = this.scene_edit.addElement({model: modelid, name: modelasset?.info.name});
            this.draw(el.id);
            this.scene_render.addModel(modelid, el.id);
        })
        listenClick("#back_to_scene_list_btn",  async (ev) => {
            this.scene_edit.save();
        })

        return this;
    }

    draw(id: string, container: HTMLElement = this.props_container) {
        const element = this.scene_edit.elements[id];

        const el = (container.querySelector('#' + id) || document.createElement('entry')) as HTMLLinkElement;
        el.id = element.id;
        el.dataset["name"] = element.name;
        el.classList.add("collapse");
        
        container.appendChild(el);
    }

    /**
     * draw list of all scene elements. SceneEdit has to be loaded
     */
    propagate(container: HTMLElement = this.props_container) {
        container.innerHTML = '';
        this.scene_render.clearModels();

        for(const id in this.scene_edit.elements) {
            const element = this.scene_edit.elements[id];
            this.draw(id);

            const model = element.model;
            if(model) {
                this.scene_render.addModel(model, id);
            }
        }
    }
}