import { Matter, Matters } from "../matters"
import ControlsContainerCollapse from "./controls_container_collapse";
import { EventListenerDetails, querySelector, listenClick, addEventListener, removeEventListeners } from "../document";
import { PropertyInput, PropertyInputMutator } from "./property_input";

export default class InspectorMatters {
    matter: Matter;
    matters: Matters;
    private _listeners: Array<EventListenerDetails>;
    container: HTMLElement | null;
    entries: { [id: string]: HTMLElement };
    subinspectors: { [id: string]: InspectorMatters }
    events: HTMLElement | null;
    inputs: { [id: string]: PropertyInput }
    mutators: { [id: string] : PropertyInputMutator };

    constructor(matter: Matter, matters: Matters) {
        this.matter = matter;
        this.matters = matters;
        this._listeners = [];
        this.entries = {};
        this.inputs = {};
        this.mutators = {};
        this.events = document.createElement("events");
    }

    init(mutators?: { [id: string] : PropertyInputMutator }) {
        const matter = this.matter;
        if (mutators) {
            this.mutators = mutators;
        }

        const container = this.init_container();
        this.container = container;
        //this.container.classList.add("collapsed");
        const header = querySelector(".header", container);
        const content = querySelector("content", container);
    
        const header_label = document.createElement("label");
        header_label.innerHTML = matter.name;
        header_label.classList.add("flex-grow-1")
        const btn_delete = document.createElement("btn");
        btn_delete.classList.add("img-delete", "fittext");
        const btn_copy = document.createElement("btn");
        btn_copy.classList.add("img-copy", "fittext");
        const btn_link = document.createElement("btn");
        btn_link.classList.add("img-link-add", "fittext");
        header.append(header_label, btn_delete, btn_copy, btn_link);
    
        new ControlsContainerCollapse(this._listeners).init(container);
        
        const id = matter.id;
        const onchange = (matter: Matter, key: string) => {
            this.events?.dispatchEvent(new CustomEvent("change", { detail : { id: matter.id, key }}));
        }
        listenClick(btn_copy, (ev) => { 
            ev.stopPropagation();
            this.events?.dispatchEvent(new CustomEvent("clone", { detail : {id}}));
        }, this._listeners);
        listenClick(btn_delete, (ev) => {
            ev.stopPropagation();
            this.events?.dispatchEvent(new CustomEvent("delete", { detail : {id}}));
        }, this._listeners);
        listenClick(btn_link, (ev) => { 
            ev.stopPropagation();
            this.events?.dispatchEvent(new CustomEvent("link", { detail : {id}}));
        }, this._listeners);

        this.propagate_fields(matter, content, onchange);

        return container;
    }

    init_container() : HTMLElement {
        const container = document.createElement("container");
        container.classList.add("style-nested", "behave-collapsing");
        const header = document.createElement("entry");
        header.classList.add('flex-row', "header");
        const content = document.createElement("content");
        content.classList.add("flex-column");
        container.appendChild(header);
        container.appendChild(content);

        return container;
    }

    init_input(matter: Matter, key: string, entry: HTMLElement, onchange?: (m: Matter, key: string) => void) : HTMLElement {
        const input = new PropertyInput(this.mutators[key] ?? null);
        this.inputs[key] = input;
        const input_container = input.init(matter[key], (value) => {
            matter.set(key, value);
            this.draw_field(key, matter, entry);
            if (onchange) {
                onchange(matter, key);
            }
        }, this._listeners);
        input_container.classList.add("width-half");

        if (!onchange) {
            input_container.classList.add("disabled");
        }


        return input_container;
    }

    init_field_controls(matter: Matter, key: string, entry: HTMLElement, onchange?: (m: Matter, key: string) => void) : HTMLElement {
        const controls = document.createElement("controls");
        controls.classList.add('flex-row');

        const icon_external_code = document.createElement("icon");
        icon_external_code.classList.add("img-external-code", "fittext");
        const btn_external_ref = document.createElement("btn");
        btn_external_ref.classList.add("img-external", "fittext");
        const btn_discard = document.createElement("btn");
        btn_discard.classList.add("img-discard", "fittext");
        const btn_remove = document.createElement("btn");
        btn_remove.classList.add("img-remove", "fittext");
        const btn_plug = document.createElement("btn");
        btn_plug.classList.add("img-plug", "fittext");

        controls.appendChild(icon_external_code);
        controls.appendChild(btn_external_ref);
        controls.appendChild(btn_discard);
        controls.appendChild(btn_remove);
        controls.appendChild(btn_plug);
        entry.appendChild(controls);

        if (onchange) {
            addEventListener({callback: ()=> {
                matter.reset(key);
                this.draw_field(key, matter, entry);
                onchange(matter, key);
            }, name: "click", node: btn_discard}, this._listeners);
            addEventListener({callback: ()=> {
                matter.reset(key);
                const el = this.entries[key];
                delete this.inputs[key];
                el.parentElement?.removeChild(el)
                onchange(matter, key);
            }, name: "click", node: btn_remove}, this._listeners);
            addEventListener({callback: ()=> {
                this.events?.dispatchEvent(new CustomEvent("external", { detail : { key, value: matter.get(key) }}));
            }, name: "click", node: btn_external_ref}, this._listeners);
            addEventListener({callback: ()=> {
                this.events?.dispatchEvent(new CustomEvent("plug", { detail : { key, value: matter.get(key), matter }}));
            }, name: "click", node: btn_plug}, this._listeners);
        } else {
            controls.classList.add("disabled");
        }

        return controls;
    }

    propagate_fields(matter: Matter, container: HTMLElement, onchange?: (m: Matter, key: string) => void) {
        for (const k in matter) {
            const entry = this.init_field(matter, container, k, onchange);
            container.appendChild(entry);
        }
    }

    init_field(matter: Matter, container: HTMLElement, key: string, onchange?: (m: Matter, key: string) => void) : HTMLElement {
        const entry = document.createElement("entry");
        entry.classList.add('flex-grow-1', 'flex-row');
        const label_name = document.createElement("label");
        label_name.innerHTML = `${key}: `;
        label_name.classList.add("flex-grow-1")
        entry.appendChild(label_name);

        const input_controls = this.init_field_controls(matter, key, entry, onchange);
        const input_value = this.init_input(matter, key, entry, onchange);

        entry.appendChild(input_value);

        if (key == "id" || key == "inherites" || key == "dependents") {
            entry.classList.add("disabled");
        } 

        this.entries[key] = entry;

        this.draw_field(key, matter, entry);

        // reqursive fields draw
        const value = matter.get(key);
        if (typeof value == "string" && value.startsWith("**") && this.matters.get(value)?.get("owner") == matter.id) {
            const subcontainer = this.init_container();
            const header = querySelector(".header", subcontainer);
            const content = querySelector("content", subcontainer);
            header.appendChild(entry);
            this.propagate_fields(this.matters.get(value), content, onchange);
            new ControlsContainerCollapse(this._listeners).init(subcontainer);
            subcontainer.classList.add("collapsed");

            return subcontainer;
        }

        return entry;
    }

    draw_field(key: string, matter: Matter = this.matter, entry: HTMLElement = this.entries[key]) {
        const icon_external_code = querySelector(".img-external-code", entry);
        const btn_external_ref = querySelector(".img-external", entry);
        const btn_discard = querySelector(".img-discard", entry);
        const btn_remove = querySelector(".img-remove", entry);
        const btn_plug = querySelector(".img-plug", entry);

        this.inputs[key].draw(matter.get(key));

        icon_external_code.classList.add("hidden");
        btn_external_ref.classList.add("hidden");
        btn_discard.classList.add("hidden");
        btn_remove.classList.add("hidden");
        btn_plug.classList.add("hidden");

        if (entry.classList.contains("disabled")) {
            return;
        }

        if (matter.is_inherited(key)) {
            icon_external_code.classList.remove("hidden");
        } else if (matter.is_overrided(key)) {
            btn_discard.classList.remove("hidden");
        } else {
            btn_remove.classList.remove("hidden");
        }

        const value =  matter.get(key);
        if ((typeof value == "string" && value.startsWith("**") && (this.matters.get(value) as any)?.owner !== matter.id)) {
            btn_external_ref.classList.remove("hidden");
            btn_plug.classList.remove("hidden");
        }

        if (matter == this.matter && key == "name" && this.container) {
            querySelector(".header label", this.container).innerHTML = value;
        }
    }

    dispose() {
        removeEventListeners(this._listeners);

        this.entries = {};
        this.inputs = {};
        this.mutators = {};
        this.events = null;

        if (this.container) {
            this.container.parentElement?.removeChild(this.container);
            this.container = null;
        }
    }
}