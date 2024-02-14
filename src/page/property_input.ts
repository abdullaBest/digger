import { addEventListener, EventListenerDetails, querySelector } from "../document";

enum PropertyInputType {
    AUTO = 0,
    COLOR = 1
}

type PropertyInputMutator = ((value: string, el: HTMLElement) => HTMLElement | undefined) | null

class PropertyInput {
    input: HTMLInputElement | HTMLElement;
    container: HTMLElement;
    datatype: string;
    customtype: PropertyInputType;
    canvas: HTMLCanvasElement;
    mutator: PropertyInputMutator | null;

    constructor(mutator?: PropertyInputMutator | null) {
        this.customtype = PropertyInputType.AUTO;
        this.mutator = mutator ?? null;
    }
    
    init(value: string, onchange: (value: any) => void, listeners?: Array<EventListenerDetails>) : HTMLElement  {
        this.canvas = querySelector("db#cache canvas#cache_canvas") as HTMLCanvasElement

        const container = document.createElement("wrap");
        this.container = container;
        container.classList.add("flex-row", "gap-minor");

        // apply mutator instead of default input
        if (this.mutator) {
            const input = this.mutator(value, this.input);

            // if mutotor did nothng it will proceed to default input
            if (input) {
                this.input = input;
                container.appendChild(this.input);
                addEventListener({callback: (ev)=> {
                    onchange((ev as CustomEvent).detail.value);
                }, name: "change", node: input}, listeners);
                return container;
            }
        }

        const input = document.createElement("input") as HTMLInputElement;
        container.appendChild(input);
        input.classList.add("flex-grow-1");
        
        const datatype = typeof value;
        if (datatype !== "string" && datatype !== "number" && datatype !== "boolean") {
            input.classList.add('disabled');
        }

        if (datatype == "boolean") {
            input.type = "checkbox"
        }
        
        addEventListener({callback: ()=> {
            let val: string | number | boolean = input.value;
            input.classList.remove('error');

            if (datatype === "number") {
                let _val = parseFloat(val);
                if (Number.isNaN(_val)) {
                    input.classList.add('error');
                    return;
                }
                val = _val;
            } else if (datatype === "boolean") {
                val = input.checked;
            }
            onchange(val);
        }, name: "change", node: input}, listeners);

        addEventListener({callback: (ev)=> {
            ev.stopPropagation();
        }, name: "click", node: input}, listeners);
        
        this.input = input;
        this.datatype = datatype;

        return container;
    }

    draw(value: any) {
        const datatype = this.datatype;
        const input = this.input as HTMLInputElement;

        if (this.mutator) {
            this.mutator(value, this.input);
            return;
        }

        if (datatype !== "string" && datatype !== "number" && datatype !== "boolean") {
            input.classList.add('disabled');
        } 

        if (datatype == "boolean") {
            input.type = "checkbox"
            input.checked = value;
        } else {
            input.value = value;
        }

        if (datatype === "string" && value.match(/^#(?:[0-9a-fA-F]{3,4}){1,2}$/)) {
            this.drawColor(value);
        }
    }

    drawColor(value: string) {
        const img = (this.container.querySelector(".img-color") || document.createElement("img")) as HTMLImageElement;
        if (!img.parentElement) {
            img.classList.add("img-color");
            this.container.appendChild(img);
        }

        const canvas = this.canvas;
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            ctx.rect(0, 0, 16, 16);
            ctx.fillStyle = value.replace("0x", "#");
            ctx.fill();
            img.src = canvas.toDataURL();
        }
    }
}

export { PropertyInput, PropertyInputMutator, PropertyInputType }
export default PropertyInput;
