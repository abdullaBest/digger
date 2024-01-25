import { querySelector, listenClick, EventListenerDetails, removeEventListeners } from "../document";

class Popup {
    private static _instance: Popup;
    container: HTMLElement;
    content: HTMLElement;
    header: HTMLElement;
    label: HTMLElement;
    private _listeners: Array<EventListenerDetails>;

    private constructor() {
        this._listeners = [];
    }

    private init(container: HTMLElement = querySelector("#popup-default")) {
        this.container = container;
        this.header = querySelector(".header", container);
        this.label = querySelector("label", this.header);
        this.content = querySelector("#popup-content", container);
    }

    static get instance() {
        if (!Popup._instance) {
            Popup._instance = new Popup();
        }

        return Popup._instance;
    }

    async confirm(message: string, propagate?: (el: HTMLElement) => void) {
        this.label.innerHTML = message;
    
        this.content.innerHTML = "";
        if (propagate) {
            propagate(this.content);
        }
    
        return this.apply();
    }

    async message(header: string, content: string) {
        this.label.innerHTML = header;
        this.content.innerHTML = content;
        
        return this.apply();
    }

    private async apply() {
        return new Promise((resolve, reject) => {
            const callback = async (ev) => {
                this.close();
                resolve(1);
            }
            const close = () => {
                this.close();
                reject('cancel');
            }
            listenClick("#popup-controls-close", close, this._listeners, this.container);
            listenClick("#popup-controls-confirm", callback, this._listeners, this.container);
        })
    }

    show(container: HTMLElement = this.container) {
        if (!container || this.container != container) {
            this.init(container);
        }

        const rootlayout = querySelector("#appcontent");
        rootlayout?.classList.add('fade');

        this.container.classList.remove("hidden");

        return this;
    }

    close() {
        this.container.classList.add("hidden");
        removeEventListeners(this._listeners);

        const rootlayout = querySelector("#appcontent");
        rootlayout?.classList.remove('fade');
    }
}

// -- deprecated

/**
 * @param message 
 */
function popupListSelect(message: string, propagete?: (el: HTMLElement) => void) : Promise<string> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    //rootlayout?.classList.add('fade');
    _popup?.classList.remove('hidden');
    if(header) {
        header.innerHTML = message;
    }

    if (propagete) {
        content.innerHTML = "";
        propagete(content);
    }

    return new Promise((resolve, reject) => {
        const delisten = () => {
            content?.removeEventListener('click', callback);
            _popup_close?.removeEventListener('click', close);
            rootlayout?.classList.remove('fade');
            _popup?.classList.add('hidden');
        }
        const callback = async (ev) => {
            const el = (ev.target as HTMLElement);
            if(el.parentElement == content && el.id) {
                delisten();
                resolve(el.id);
            }
        }
        const close = () => {
            delisten();
            reject('cancel');
        }
        content?.addEventListener('click', callback);
        _popup_close?.addEventListener('click', close);
    })
}

/**
 * @param message 
 */
function popupListSelectMultiple(message: string, propagate?: (el: HTMLElement) => void) : Promise<Array<string>> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    //rootlayout?.classList.add('fade');
    _popup?.classList.remove('hidden');
    if(header) {
        header.innerHTML = message;
    }

    if (propagate) {
        content.innerHTML = "";
        propagate(content);
    }

    const btn = document.createElement("btn");
    btn.innerHTML = "confirm";
    content.appendChild(btn);

    return new Promise((resolve, reject) => {
        const delisten = () => {
            content?.removeEventListener('click', callback_select);
            btn?.removeEventListener('click', callback_confirm);
            _popup_close?.removeEventListener('click', close);
            rootlayout?.classList.remove('fade');
            _popup?.classList.add('hidden');
        }
        const callback_select = async (ev) => {
            const el = (ev.target as HTMLElement);
            if(el.parentElement == content && el.id) {
                el.classList.toggle('highlighted');
            }
        }
        const callback_confirm = async (ev) => {
            delisten();
            const list: Array<string> = [];
            const ellist = content?.querySelectorAll('.highlighted');
            ellist.forEach((e) => {
                list.push(e.id);
            })
            resolve(list);
        }
        const close = () => {
            delisten();
            reject('cancel');
        }
        content?.addEventListener('click', callback_select);
        btn?.addEventListener('click', callback_confirm);
        _popup_close?.addEventListener('click', close);
    })
}

/**
 * 
 * @param message 
 */
function popupConfirm(message, propagete?: (el: HTMLElement) => void) : Promise<number> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    //rootlayout?.classList.add('fade');
    _popup?.classList.remove('hidden');
    if(header) {
        header.innerHTML = message;
    }

    content.innerHTML = "";
    if (propagete) {
        propagete(content);
    }

    const btn = document.createElement("btn");
    btn.innerHTML = "confirm";
    content.appendChild(btn);

    return new Promise((resolve, reject) => {
        const delisten = () => {
            content?.removeEventListener('click', callback);
            _popup_close?.removeEventListener('click', close);
            rootlayout?.classList.remove('fade');
            _popup?.classList.add('hidden');
        }
        const callback = async (ev) => {
            delisten();
            resolve(1);
        }
        const close = () => {
            delisten();
            reject('cancel');
        }
        btn?.addEventListener('click', callback);
        _popup_close?.addEventListener('click', close);
    })
}

export default Popup;
export { Popup, popupConfirm, popupListSelect, popupListSelectMultiple };