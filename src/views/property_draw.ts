export default class PropertyDraw {
    container: HTMLElement;
    object: any;
    values: {[id: string]: any}
    getters: {[id: string]: () => any}
    elements: {[id: string]: HTMLElement}

    constructor(container: HTMLElement) {
        this.container = container;
    }

    init(object: any) {
        this.object = object;
        this.elements = {};
        this.values = {};
        this.getters = {};
    }

    dispose() {
        for(const k in this.elements) {
            const el = this.elements[k];
            el.parentElement?.removeChild(el);
        }

        this.elements = {};
        this.values = {};
        this.getters = {};
        this.object = null;
    }

    add(key: string, getter?: () => any) {
        this.getters[key] = getter ?? (() => this.object[key]);
        this.values[key] = this.getters[key]();
    }

    draw(key: string) {
        const value =  this.getters[key]();
        if (this.elements[key] && this.values[key] === value) {
            return;
        }

        let el = this.elements[key];
        if (!el) {
            el = document.createElement("entry");
            el.id = key;
            this.container.appendChild(el);
            this.elements[key] = el;
        }

        this.values[key] = value;
        el.innerHTML = `<label>${key}: <label>${value}</label></label>`
    }

    step() {
        for(const k in this.values) {
            this.draw(k);
        }
    }


}