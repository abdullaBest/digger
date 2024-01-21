import { Matter, Matters } from "../matters"
import ControlsContainerCollapse from "./controls_container_collapse";
import { EventListenerDetails, querySelector, listenClick, addEventListener, removeEventListeners } from "../document";

export default class InspectorMatters {
    matter: Matter;
    matters: Matters;
    private _listeners: Array<EventListenerDetails>;
    container: HTMLElement | null;
    entries: { [id: string]: HTMLElement };
    subinspectors: { [id: string]: InspectorMatters }
    events: HTMLElement;

    constructor(matter: Matter, matters: Matters) {
        this.matter = matter;
        this.matters = matters;
        this._listeners = [];
        this.entries = {};
        this.events = document.createElement("events");
    }

    init(clone: (m: Matter) => void, del: (m: Matter) => void, link: (m: Matter) => void, onchange: (m: Matter, key: string) => void) {
        const matter = this.matter;

        const container = this.init_container();
        this.container = container;
        const header = querySelector("header", container);
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
        
        this.propagate_fields(matter, content, onchange);

        listenClick(btn_copy, (ev) => { 
            ev.stopPropagation();
            clone(matter); 
        }, this._listeners);
        listenClick(btn_delete, (ev) => {
            ev.stopPropagation();
            del(matter)
        }, this._listeners);
        listenClick(btn_link, (ev) => { 
            ev.stopPropagation();
            link(matter);
        }, this._listeners);

        return container;
    }

    init_container() : HTMLElement {
        const container = document.createElement("container");
        container.classList.add("style-nested", "behave-collapsing");
        const header = document.createElement("header");
        header.classList.add('flex-row');
        const content = document.createElement("content");
        content.classList.add("flex-column");
        container.appendChild(header);
        container.appendChild(content);

        return container;
    }

    init_input(matter: Matter, key: string, entry: HTMLElement, onchange?: (m: Matter, key: string) => void) : HTMLInputElement {
        const input_value = document.createElement("input") as HTMLInputElement;
        input_value.value = matter[key] ?? "none";
        input_value.size = 10;

        const datatype = typeof matter[key];
        if (datatype !== "string" && datatype !== "number") {
            input_value.classList.add('disabled');
        }
        if (onchange) {
            addEventListener({callback: ()=> {
                let val: string | number = input_value.value;
                input_value.classList.remove('error');

                if (datatype === "number") {
                    let _val = parseFloat(val);
                    if (Number.isNaN(_val)) {
                        input_value.classList.add('error');
                        return;
                    }
                    val = _val;
                }
                matter.set(key, val);
                this.draw_field(key, matter, entry);
                onchange(matter, key);
            }, name: "change", node: input_value}, this._listeners);

            addEventListener({callback: (ev)=> {
                ev.stopPropagation();
            }, name: "click", node: input_value}, this._listeners);
        } else {
            input_value.classList.add("disabled");
        }

        entry.appendChild(input_value);

        this.entries[key] = entry;

        return input_value;
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

        controls.appendChild(icon_external_code);
        controls.appendChild(btn_external_ref);
        controls.appendChild(btn_discard);
        entry.appendChild(controls);

        if (onchange) {
            addEventListener({callback: ()=> {
                matter.reset(key);
                this.draw_field(key, matter, entry);
                onchange(matter, key);
            }, name: "click", node: btn_discard}, this._listeners);
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

        if (key == "id" || key == "inherites" || key == "dependents") {
            entry.classList.add("disabled");
        } 

        this.draw_field(key, matter, entry);

        /*
        // reqursive fields draw
        const value = matter.get(key);
        if (typeof value == "string" && value.startsWith("**")) {
            const subcontainer = this.init_container();
            const header = querySelector("header", subcontainer);
            const content = querySelector("content", subcontainer);
            header.appendChild(entry);
            this.propagate_fields(this.matters.get(value.substring(2)), content);
            new ControlsContainerCollapse(this._listeners).init(subcontainer);

            return subcontainer;
        }
        */

        return entry;
    }

    draw_field(key: string, matter: Matter = this.matter, entry: HTMLElement = this.entries[key]) {
        const icon_external_code = querySelector(".img-external-code", entry);
        const btn_external_ref = querySelector(".img-external", entry);
        const btn_discard = querySelector(".img-discard", entry);
        const input_value = querySelector("input", entry) as HTMLInputElement;

        input_value.value = matter.get(key);

        icon_external_code.classList.add("hidden");
        btn_external_ref.classList.add("hidden");
        btn_discard.classList.add("hidden");

        if (entry.classList.contains("disabled")) {
            return;
        }

        if (matter.is_inherited(key)) {
            icon_external_code.classList.remove("hidden");
        } else if (matter.is_overrided(key)) {
            btn_discard.classList.remove("hidden");
        }

        const value =  matter.get(key);
        if (typeof value == "string" && value.startsWith("**")) {
            btn_external_ref.classList.remove("hidden");
        }

        if (key == "name" && this.container) {
            querySelector("header label", this.container).innerHTML = value;
        }
    }

    dispose() {
        removeEventListeners(this._listeners);

        this.entries = {};

        if (this.container) {
            this.container.parentElement?.removeChild(this.container);
            this.container = null;
        }
    }
}