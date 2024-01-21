import { Matters, Matter } from "../matters"
import InspectorMatter from "../page/inspector_matters";

const inspectors = {};

function draw(container: HTMLElement, matters: Matters) {
    container.innerHTML = "";
    for(const k in inspectors) {
        inspectors[k].dispose();
        delete inspectors[k];
    }

    const del = (m: Matter) => {
        matters.remove(m.id);
        draw(container, matters);
    }

    const clone = (m: Matter) => {
        matters.clone(m.id);
        draw(container, matters);
    }

    const link = (m: Matter) => {
        matters.inherite(m.id);
        draw(container, matters);
    }

    const change = (m: Matter, key: string) => {
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
        container.appendChild(inspector.init(clone, del, link, change));
    }

    for(const k in matters.list) {
        construct_inpector(matters.get(k));
    }
}

export default function main(container: HTMLElement, matters?: Matters) {
    const _matters = matters ?? new Matters().init();

    const testmatter1 = _matters.create({ value: 666, value1: 18 });
    const testmatter2 = _matters.create({ value: 777, value2: 13}, testmatter1.id);
    const testmatter3 = _matters.create({ link: "**" + testmatter2.id}, testmatter1.id);
    const testmatter4 = _matters.create({}, testmatter3.id);

    draw(container, _matters)
}