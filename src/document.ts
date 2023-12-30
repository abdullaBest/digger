/**
 * Page helpers functions
 */


export function querySelector(query: string, root: HTMLElement = document.body) : HTMLElement {
    const element = root.querySelector(query) as HTMLElement;
    if (!element) { throw new Error("can't find element matching query " + query); }
    return element;
}

export interface EventListenerDetails {
    callback: EventListenerOrEventListenerObject;
    name: string;
    node: HTMLElement;
} 

/**
 * 
 * @param opts event listener properties
 * @param list array list to append properties to
 * @returns listened event properties
 */
export function addEventListener(opts: EventListenerDetails, list?: Array<EventListenerDetails>) : EventListenerDetails {
    opts.node.addEventListener(opts.name, opts.callback);
    list?.push(opts);

    return opts;
}

export function removeEventListeners(list: Array<EventListenerDetails>) {
    while(list.length) {
        const l = list.pop();
        l?.node?.removeEventListener(l.name, l.callback);
    }
}

/**
 * @param message 
 */
export function popupListSelect(message: string, propagete?: (el: HTMLElement) => void) : Promise<string> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    rootlayout?.classList.add('fade');
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
export function popupListSelectMultiple(message: string, propagate?: (el: HTMLElement) => void) : Promise<Array<string>> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    rootlayout?.classList.add('fade');
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
export function popupConfirm(message, propagete?: (el: HTMLElement) => void) : Promise<number> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = querySelector("#popup_content");

    rootlayout?.classList.add('fade');
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

export function listenClick(selector: string, callback: (event: MouseEvent) => any, list?: Array<EventListenerDetails>, container?: HTMLElement) : EventListenerDetails {
    return addEventListener({node: querySelector(selector, container), callback: callback as any, name: "click"}, list)
}

export function listenClickAll(selector: string, callback: (event: Event) => any, list?: Array<EventListenerDetails>) : Array<EventListenerDetails> {
    const listeners: Array<EventListenerDetails> = [];
    const elements = document.body.querySelectorAll(selector);
    elements.forEach((node) => {
        listeners.push(addEventListener({node: node as HTMLElement, callback, name: "click"}, list))
    })
    return listeners;
}

/**
 * Hides all "page" elements in container except one with passed id
 * @param id id of element to display
 */
export function switchPage(id: string) : HTMLElement {
    // find requested element
    const el = document.querySelector(id) as HTMLElement;
    if(!el) { throw new Error("page: no such element " + id); }
    if (!el.parentElement) { throw new Error(`page: element #${id} has no parent`); }

    const pages = document.querySelectorAll(`#${el.parentElement.id} > page`);
    pages.forEach((v) => {
        if (id.includes(v.id)) {
            v.classList.remove('hidden');
        } else {
            v.classList.add('hidden');
        }
    })

	return el;
}

export function reattach(element: Element, container: Element) {
    if(element.parentElement == container) {
        return;
    }
    element.parentElement?.removeChild(element);
    container.appendChild(element);
}
