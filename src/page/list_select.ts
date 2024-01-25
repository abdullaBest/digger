import { EventListenerDetails, querySelector, listenClick, removeEventListeners } from "../document";

export default class ListSelect {
    private _listeners: Array<EventListenerDetails>;
    private buttons: Array<HTMLElement> | null;
    private tabs: Array<HTMLElement> | null;

    constructor() {
        this._listeners = [];
    }

    init(buttons_container: HTMLElement, callback?: (id: string) => void) {
        this.buttons = [];

        const buttons = buttons_container.querySelectorAll("btn.option")
        for(let i = 0; i < buttons.length; i++) {
            const btn = buttons[i] as HTMLElement;
           
            listenClick(btn, () => { 
                this.click(btn.id);
                if(callback) {
                    callback(btn.id);
                }
            }, this._listeners);
            this.buttons.push(btn);
        }

        this.click('');

        return this;
    }

    click(id: string) {
        if (!this.buttons ) {
            throw new Error("ListSelect::click error. Wasn't initialized.")
        }

        for(const i in this.buttons) {
            const btn = this.buttons[i];

            btn.classList[btn.id == id ? "toggle" : "remove"]("highlighted");
        }
    }

    selected(): Array<string> {
       const selected: Array<string> = [];
       for(const i in this.buttons) {
            const btn = this.buttons[i];
            if (btn.classList.contains('highlighted')) {
                selected.push(btn.id);
            }
       }

       return selected;
    }

    dispose() {
        removeEventListeners(this._listeners);
        this.buttons = null;
        this.tabs = null;
    }
}