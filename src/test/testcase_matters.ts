import { Matters, Matter } from "../matters"
import InspectorMatter from "../page/inspector_matters";

const inspectors: { [id: string] : InspectorMatter } = {};

function draw(container: HTMLElement, matters: Matters) {
    container.innerHTML = "";
    for(const k in inspectors) {
        inspectors[k].dispose();
        delete inspectors[k];
    }

    const del = (id: string) => {
        const m = matters.get(id);
        matters.remove(m.id);
        draw(container, matters);
    }

    const clone = (id: string) => {
        const m = matters.get(id);
        matters.clone(m.id);
        draw(container, matters);
    }

    const link = (id: string) => {
        const m = matters.get(id);
        matters.inherite(m.id);
        draw(container, matters);
    }

    const change = (id: string, key: string) => {
        const m = matters.get(id);
        let dependents = m.dependents;
        for(const k in matters.list) {
            const _m = matters.get(k);
            if (_m.inherites == m.id) {
                inspectors[_m.id].draw_field(key);
                dependents -= 1;
            }

            if (dependents <= 0) {
                break;
            }
        }
    }

    const construct_inpector = (matter: Matter) => {
        const inspector = new InspectorMatter(matter, matters);
        inspectors[matter.id] = inspector;
        if (inspector.events) {
            inspector.events.addEventListener("change", ((ev: CustomEvent) => change(ev.detail.id, ev.detail.key)) as EventListener)
            inspector.events.addEventListener("link", ((ev: CustomEvent) => link(ev.detail.id)) as EventListener)
            inspector.events.addEventListener("clone", ((ev: CustomEvent) => clone(ev.detail.id)) as EventListener)
            inspector.events.addEventListener("delete", ((ev: CustomEvent) => clone(ev.detail.id)) as EventListener)
        }
        container.appendChild(inspector.init());
    }

    for(const k in matters.list) {
        construct_inpector(matters.get(k));
    }
}

export default function main(container: HTMLElement, matters?: Matters) {
    const _matters = matters ?? new Matters().init();

    const testmatter1 = _matters.create({ value: 666, value1: 18 });
    const testmatter2 = _matters.create({ value: 777, value2: 13}, testmatter1.id);
    const testmatter3 = _matters.create({ link: "**" + testmatter2.id }, testmatter1.id);
    const testmatter4 = _matters.create({ link: "**" + testmatter3.id }, testmatter3.id);

    draw(container, _matters)
}