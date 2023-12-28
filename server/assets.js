import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from "path";

export default class Assets {
    constructor() {
        this.content = {
            data: {},
            guids: 0
        }
        this.data = {};
        this.filename = "assets.json"
        this.directory = ""
    }
    /**
     * @param {import('node:fs').PathOrFileDescriptor} path assets data path
     */
    async load(path) {
        const filecontent = await fs.readFile(path);
        this.content = JSON.parse(filecontent);
    }

    /**
     * 
     * @param {import('node:fs').PathOrFileDescriptor} path file path to save
     * @param {Object} json data to write 
     */
    async write(path, json) {
        fs.writeFile(path, JSON.stringify(json));
    }

    /**
     * 
     * @param {Object} opts .
     * @param {String} opts.id uniq asset id
     * @param {String} opts.filename file name on disk
     * @param {String} opts.name display name
     * @param {String} opts.type data type
     * @param {String} opts.extension file extension based on filename
     * @param {Number} opts.size data size
     */
    async register({ id, filename, name, type, size, extension }) {
        this.content.data[id] = {
            id,
            filename,
            name,
            type,
            size,
            extension,
            revision: 0,
            revisions: [filename]
        }

        await this.save();
    }

    /**
     * @param {string} id returns asset by id
     */
    get(id) {
        return this.content.data[id] ?? null;
    }

    /**
     * @returns {Array<string>} list of all assets ids
     */
    keys() {
        return Object.keys(this.content.data);
    }

    /**
     * @returns {string} unique id
     */
    genId() {
        return "a_" + this.content.guids++;
    }

    async save() {
        const filepath = path.join(this.directory, this.filename);
        await this.write(filepath, this.content);
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