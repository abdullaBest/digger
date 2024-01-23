import { querySelector } from "../document";
/**
 * @param message 
 */
export function popupListSelect(message: string, propagete?: (el: HTMLElement) => void) : Promise<string> {
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
export function popupListSelectMultiple(message: string, propagate?: (el: HTMLElement) => void) : Promise<Array<string>> {
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
export function popupConfirm(message, propagete?: (el: HTMLElement) => void) : Promise<number> {
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