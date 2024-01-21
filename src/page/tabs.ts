import { EventListenerDetails, querySelector, listenClick, removeEventListeners } from "../document";

export default class Tabs {
    private _listeners: Array<EventListenerDetails>;
    private buttons: Array<HTMLElement> | null;
    private tabs: Array<HTMLElement> | null;

    constructor() {
        this._listeners = [];
    }

    init(buttons_container: HTMLElement, tabs_container: HTMLElement, callback?: (id: string) => void) {
        this.buttons = [];
        this.tabs = [];

        const buttons = buttons_container.querySelectorAll("btn.tab-switch")
        for(let i = 0; i < buttons.length; i++) {
            const btn = buttons[i] as HTMLElement;
            const id = btn.dataset.tab;
            if (!id) {
                throw new Error("Tabs::init error - btn has no attribute 'data-tab' set.")
            }
            const tab = querySelector("#" + id, tabs_container);
            listenClick(btn, () => { 
                this.click(id);
                if(callback) {
                    callback(id);
                }
            }, this._listeners);
            this.buttons.push(btn);
            this.tabs.push(tab);
        }

        this.click('');

        return this;
    }

    click(id: string) {
        if (!this.buttons || !this.tabs) {
            throw new Error("Tabs::click error. Wasn't initialized.")
        }

        for(const i in this.buttons) {
            const btn = this.buttons[i];
            const tab = this.tabs[i];

            btn.classList[btn.dataset.tab == id ? "add" : "remove"]("highlighted");
            tab.classList[tab.id == id ? "remove" : "add"]("hidden");
        }
    }

    dispose() {
        removeEventListeners(this._listeners);
        this.buttons = null;
        this.tabs = null;
    }
}