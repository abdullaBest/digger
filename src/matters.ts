

class Matter {
    inherites: string | null;
    dependents: number;
    id: string;
    name: string;

    constructor(id: string, name: string, inherite: string | null) {
        this.id = id;
        this.name = name;
        this.inherites = inherite;
        this.dependents = 0;
    }

    set(key: string, value: string | number | boolean) {
        this[key] = value;
    }

    get(key: string) {
        return this[key];
    }

    reset(key) {
        delete this[key];
    }

    get_base() {
        let p = this;
        while(p.inherites && p.id != "base") {
            p = p.get_prototype();
        }

        return p;
    }

    is_overrided(key: string) {
        return this.hasOwnProperty(key) && (key in this.get_prototype());
    }

    is_inherited(key: string) {
        return !this.hasOwnProperty(key) && (key in this);
    }

    inherited_equals(key: string, value: any) {
        let p = this;
        while (true) {
            if (p[key] === value) {
                return true;
            }

            if (!p.inherites || p.id == "base") {
                break;
            }

            p = p.get_prototype();
        }

        return false;
    }

    get_prototype() {
        return Object.getPrototypeOf(this);
    }
}

class Matters {
    list: { [id: string]: any };
    guids: number;
    base_matter: Matter;

    constructor() {
        this.list = {};
        this.guids = 0;
    }

    init() : Matters {
        // #code-debt-minor: new Matter() instance not gonna be used. It will be rewritten be create() method 
        this.base_matter = new Matter("base", "base_matter", null);
        this.list[this.base_matter.id] = this.base_matter;
        return this;
    }

    get(id: string) : Matter {
        return this.list[id];
    }

    /**
     * creates new matter instance and puts in list
     * 
     * @param content will be used by value. no references saved
     * @param inherite matter id that should be prototype of new matter
     * @param name .
     * @param id .
     */
    create(content: any, inherite?: string | null, id?: string, name?: string) : Matter {
        const _id = id ?? content.id ?? this.newid();
        const _name = name ?? content.name ?? _id;
        const _inherites = inherite ?? content.inherites ?? this.base_matter.id;
        const matter = { ...content, id: _id, name: _name, inherites: _inherites, dependents: 0 };

        if (this.list[_id]) {
            throw new Error(`Matters::create error - Matter ${_id} already exists.`);
        }

        if (_inherites) {
            const inherited = this.list[_inherites];
            if (!inherited) {
                throw new Error(`Matters::create error - Matter ${_id} tries to inherit ${_inherites} wich does not exist.`);
            }
            Object.setPrototypeOf(matter, inherited);
            inherited.dependents += 1;
        }
        this.list[matter.id] = matter;

        return matter;
    }

    replace(content: any, id: any) {
        const _id = id ?? content.id;
        const matter = this.list[_id]
        if (!matter) {
            throw new Error(`Matters::replace error - Matter ${_id} does not exist.`);
        }

        return Object.assign(matter, content);
    }

    remove(id: string) {
        const matter = this.list[id];
        if (!matter) {
            throw new Error(`Matters::remove error - No matter ${id} found.`);
        }

        if (matter.dependents) {
            throw new Error(`Matters::remove error - Can't remove matter ${id} while it has ${matter.dependents} dependents.`);
        }

        if (matter.inherites) {
            matter.get_prototype().dependents -= 1;
        }

        delete this.list[id];
    }

    newid() {
        return "m_" + this.guids++;
    }

    clone(id: string) : Matter {
        const matter = this.list[id];
        if (!matter) {
            throw new Error(`Matters::clone error - No matter ${id} found.`);
        }

        return this.create(matter, null, this.newid());
    }

    inherite(id: string, content: any = {}) : Matter {
        const matter = this.list[id];
        if (!matter) {
            throw new Error(`Matters::inherite error - No matter ${id} found.`);
        }

        return this.create(content, id, this.newid());
    }
}

export default Matters;
export { Matter, Matters };