import { EventListenerDetails } from "./events";

/**
 * Page helpers functions
 */


export function querySelector(query: string, root: HTMLElement = document.body) : HTMLElement {
    const element = root.querySelector(query) as HTMLElement;
    if (!element) { throw new Error("can't find element matching query " + query); }
    return element;
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


export function listenClick(selector: string | HTMLElement, callback: (event: MouseEvent) => any, list?: Array<EventListenerDetails>, container?: HTMLElement) : EventListenerDetails {
    const node = typeof selector === "string" ? querySelector(selector, container) : selector;
    return addEventListener({node, callback: callback as any, name: "click"}, list)
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

export { EventListenerDetails };