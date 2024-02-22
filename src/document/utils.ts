/**
 * Page helpers functions
 */

import { EventListenerDetails } from "../core/events";

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

export function reattach(element: Element, container: Element) {
    if(element.parentElement == container) {
        return;
    }
    element.parentElement?.removeChild(element);
    container.appendChild(element);
}

export { EventListenerDetails };
