export interface EventListenerDetails {
    callback: EventListenerOrEventListenerObject;
    name: string;
    node: HTMLElement;
} 

export default class Events {
    core: HTMLElement;
    guids: number;
    list: { [id: number] : EventListenerDetails };

    constructor(node?: HTMLElement) {
        this.core = node ?? document.createElement("events");
        this.guids = 0;
        this.list = {};
    }

    on(name: string, callback: (details: any) => void) : number {
        const guid = this.guids++;
        const _callback = ((ev: CustomEvent) => callback(ev.detail)) as EventListener;
        this.core.addEventListener(name, _callback);
        
        this.list[guid] = { callback: _callback, name, node: this.core };

        return guid;
    }

    off(id: number) {
        const ev = this.list[id];
        ev?.node?.removeEventListener(ev.name, ev.callback);
        delete this.list[id];
    }

    emit(name: string, detail: any) {
        this.core.dispatchEvent(new CustomEvent(name, { detail }));
    }
}