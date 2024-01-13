export default class PropertyDraw {
    container: HTMLElement;
    object: any;
    getters: {[id: string]: () => any}
    setters: {[id: string]: (v: any) => void}
    elements: {[id: string]: HTMLElement}
    labels_read: { [id: string]: HTMLLabelElement }
    values_read: { [id: string]: any }
    inputs_write: { [id: string]: HTMLInputElement }
    values_write: { [id: string]: any }

    constructor(container: HTMLElement) {
        this.container = container;
    }

    init(object: any) : PropertyDraw {
        this.dispose();
        this.object = object;

        return this;
    }

    dispose() {
        for(const k in this.elements) {
            const el = this.elements[k];
            el.parentElement?.removeChild(el);
        }

        this.elements = {};
        this.getters = {};
        this.setters = {};
        this.values_read = {};
        this.labels_read = {};
        this.values_write = {};
        this.inputs_write = {};
        this.object = null;
    }

    add(key: string, getter?: () => any) {
        this.getters[key] = getter ?? (() => this.object[key]);
        this.values_read[key] = this.getters[key]();
        this.drawRead(key);
    }

    addRead(key: string, getter?: () => any) {
        this.add(key, getter);
    }

    addWrite(key: string, getter?: () => any, setter?: (v: any) => void) {
        this.getters[key] = getter ?? (() => this.object[key]);
        this.setters[key] = setter ?? ((v: any) => this.object[key] = v);
        this.values_write[key] = this.getters[key]();
        this.drawWrite(key);
    }

    drawRead(key: string) {
        const value =  this.getters[key]();
        if (this.elements[key] && this.values_read[key] === value) {
            return;
        }

        let label = this.labels_read[key];
        if (!label) {
            const el = document.createElement("entry");
            el.id = key;

            const l1 = document.createElement("label");
            l1.innerHTML = `${key}: `;
            el.appendChild(l1);

            label = document.createElement("label");
            label.classList.add("limit-len");
            el.appendChild(label);
            this.container.appendChild(el);

            this.elements[key] = el;
            this.labels_read[key] = label;
        }
        
        let v = value;
        if (typeof value === "number" && value % 1) {
            v = value.toFixed(2);
        }
        label.innerHTML = this.values_read[key] = v;
    }

    drawWrite(key: string) {
        let input = this.inputs_write[key];
        if (!input) {
            const el = document.createElement("entry");
            el.id = key;

            const l1 = document.createElement("label");
            l1.innerHTML = `${key}: `;
            el.appendChild(l1);

            input = document.createElement("input");
            const value = this.getters[key]();
            const type = typeof value;
            input.value = this.getters[key]();
            input.type = typeof value;
            el.appendChild(input);
            this.container.appendChild(el);

            this.elements[key] = el;
            this.inputs_write[key] = input;
            
            input.addEventListener("change", (ev) => {
                const target = ev.target as HTMLInputElement;
                if (target) {
                    const _value = target.value;
                    let value: any = null; 
                    switch(type) {
                        case "number":
                            value = parseFloat(_value);
                            if (Number.isNaN(value)) {
                                input.classList.add("error");
                                return;
                            }
                            break;
                        case "boolean":
                            value = 
                                _value == "true" ? true :
                                _value == "false" ? false :
                                !!(value);
                            break; 
                        default:
                            console.warn("No implemetation for input " + type);
                            return;
                    }

                    input.classList.remove("error");

                    this.setters[key](value);
                }
            })
        }
    }

    step() {
        for(const k in this.values_read) {
            this.drawRead(k);
        }
    }

}