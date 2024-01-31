import { AssetContentTypeComponent, AssetContentTypeModel } from '../assets';

export default class MapSystem {
    priority: number;
    constructor() {
        this.priority = 0;
    }
    async load(component: AssetContentTypeComponent) {}
    async add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {}
    remove(component: AssetContentTypeComponent) {}
    filter(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) : boolean { return false; }
    step(dt: number) {};
}