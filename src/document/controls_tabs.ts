import { EventListenerDetails, querySelector, listenClick, removeEventListeners } from ".";

/**
 * @example pug
 * btns
 *   btn(data-tab="opt1-tab")
 * tabs
 *   tab#opt1-tab  
 */
export default class ControlsTabs {
    private _listeners: Array<EventListenerDetails>;
    private buttons: Array<HTMLElement> | null;
    private tabs: Array<HTMLElement> | null;
		private callback?: (id: string) => void;

		buttons_container: HTMLElement;
		tabs_container: HTMLElement;

    constructor(buttons_container: HTMLElement, tabs_container: HTMLElement) {
        this._listeners = [];
				this.buttons_container = buttons_container;
				this.tabs_container = tabs_container;
    }

    init(callback?: (id: string) => void) {
        this.buttons = [];
        this.tabs = [];
				this.callback = callback;

        const buttons = this.buttons_container.querySelectorAll("btn.tab-switch")
        for(let i = 0; i < buttons.length; i++) {
            const btn = buttons[i] as HTMLElement;
            const id = btn.dataset.tab;
            if (!id) {
                throw new Error("ControlsTabs::init error - btn has no attribute 'data-tab' set.")
            }
            const tab = querySelector("#" + id, this.tabs_container);
            listenClick(btn, () => { 
                this.click(id);
            }, this._listeners);
            this.buttons.push(btn);
            this.tabs.push(tab);
        }

        this.click('');

        return this;
    }

    click(id: string) {
        if (!this.buttons || !this.tabs) {
            throw new Error("ControlsTabs::click error. Wasn't initialized.")
        }

        for(const i in this.buttons) {
            const btn = this.buttons[i];
            const tab = this.tabs[i];

            btn.classList[btn.dataset.tab == id ? "add" : "remove"]("highlighted");
            tab.classList[tab.id == id ? "remove" : "add"]("hidden");
        }

				if(this.callback) {
					this.callback(id);
				}
    }

    dispose() {
        removeEventListeners(this._listeners);
        this.buttons = null;
        this.tabs = null;
    }
}
