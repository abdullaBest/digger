import { Assets, Asset } from "../assets";
import InspectorMatter from "../page/inspector_matters";

const inspectors: { [id: string] : InspectorMatter } = {};

export default function main(container: HTMLElement, assets: Assets) {
    container.innerHTML = "";
    const construct_inpector = (asset: Asset) => {
        if (!asset.content) {
            console.log(asset);
            return;
        }
        const inspector = new InspectorMatter(asset.content, assets.matters);
        inspectors[asset.id] = inspector;
        container.appendChild(inspector.init());
    }

    for(const k in assets.list) {
        construct_inpector(assets.get(k));
    }
}