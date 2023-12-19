import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from "path";

export default class Assets {
    constructor() {
        this.data = {};
        this.filename = "assets.json"
        this.directory = ""
    }
    /**
     * @param {import('node:fs').PathOrFileDescriptor} path assets data path
     */
    async load(path) {
        const filecontent = await fs.readFile(path);
        this.data = JSON.parse(filecontent);
    }

    /**
     * 
     * @param {import('node:fs').PathOrFileDescriptor} path file path to save
     * @param {Object} json data to write 
     */
    async save(path, json) {
        fs.writeFile(path, JSON.stringify(json));
    }

    /**
     * 
     * @param {Object} opts .
     * @param {String} opts.id uniq asset id
     * @param {String} opts.filename file name on disk
     * @param {String} opts.name display name
     * @param {String} opts.type data type
     * @param {Number} opts.size data size
     */
    async register({ id, filename, name, type, size }) {
        this.data[id] = {
            id,
            filename,
            name,
            type,
            size
        }

        const filepath = path.join(this.directory, this.filename);
        await this.save(filepath, this.data);
    }

    /**
     * @param {String} directory root directory 
     */
    async init(directory) {
        this.directory = directory;
        const filepath = path.join(this.directory, this.filename);
        if (existsSync(filepath)) {
            await this.load(filepath);
        }
    }
}