import { AssetContentTypeComponent, AssetContentTypeModel } from '../assets';

class MapSystem {
    priority: number;
    async load(component: AssetContentTypeComponent) {}
    async add(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) {}
    remove(component: AssetContentTypeComponent) {}
    filter(component: AssetContentTypeComponent, owner?: AssetContentTypeComponent) : boolean { return false; }
}

export { MapSystem }