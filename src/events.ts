export interface EventListenerDetails {
    callback: EventListenerOrEventListenerObject;
    name: string;
    node: HTMLElement;
} 

export default class Events {
    core: HTMLElement;
    guids: number;
    list: { [id: string] : EventListenerDetails };

    constructor(node?: HTMLElement) {
        this.core = node ?? document.createElement("events");
        this.guids = 0;
        this.list = {};
    }

    on(name: string, callback: (details: any) => void, list?: Array<EventListenerDetails>) : number {
        const guid = this.guids++;
        const _callback = ((ev: CustomEvent) => callback(ev.detail)) as EventListener;
        this.core.addEventListener(name, _callback);
        
        const opts =  { callback: _callback, name, node: this.core };
        this.list[guid] = opts;
        list?.push(opts);

        return guid;
    }

    off(id: string) {
        const ev = this.list[id];
        ev?.node?.removeEventListener(ev.name, ev.callback);
        delete this.list[id];
    }

    emit(name: string, detail: any) {
        this.core.dispatchEvent(new CustomEvent(name, { detail }));
    }

    dispose() {
        for(const k in this.list) {
            this.off(k);
        }
    }
}