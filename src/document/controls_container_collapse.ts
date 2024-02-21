import { EventListenerDetails, querySelector, listenClick, removeEventListeners } from ".";

/**
 * Manages collapse by click on container
 * @example pug
 * container#yourcontainer
 *  .header name always visible
 *  content
 *   ul collapsing content
 */
export default class ControlsContainerCollapse {
    private _listeners: Array<EventListenerDetails>;

    constructor(listeners: Array<EventListenerDetails> = []) {
        this._listeners = listeners;
    }

    init(container: HTMLElement) : ControlsContainerCollapse {
        const header = querySelector(".header", container);
        const content = querySelector("content", container);

        listenClick(header, () => {
            container.classList.toggle("collapsed");
        }, this._listeners)

        return this;
    }

    dispose() {
        removeEventListeners(this._listeners);
    }

    /**
     * creates multiple ControlsContainerCollapse instances for all selected elements
     * 
     * @param container
     * @param selector
     */
    static construct(container: HTMLElement, selector: string = "container.behave-collapsing"): { [id:string] : ControlsContainerCollapse } {
        const list = {};
        const windows = container.querySelectorAll(selector);
        for(let i = 0; i < windows.length; i++) {
            const window = windows[i] as HTMLElement;
            const cw = new ControlsContainerCollapse().init(window);
            list[window.id] = cw;
        }

        return list;
    }
}