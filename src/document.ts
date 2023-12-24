/**
 * Page helpers functions
 */

/**
 * 
 * @param message 
 */
export function popup(message) : Promise<string> {
    const header = document.getElementById("popup_header");
    const rootlayout = document.getElementById("rootlayout");
    const _popup = document.getElementById("popup");
    const _popup_close = document.getElementById("popup_close");
    const content = document.getElementById("popup_content");

    rootlayout?.classList.add('fade');
    _popup?.classList.remove('hidden');
    if(header) {
        header.innerHTML = message;
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

export function listenClick(selector: string, callback: (event: Event) => any) {
    const btn = document.querySelector(selector);
    if (!btn) {
        throw new Error("listenClick error: can't find element " + selector);
    }

    btn.addEventListener('click', callback);
}
