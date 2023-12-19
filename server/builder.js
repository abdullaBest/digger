import { build_js, build_less, build_pug } from "./build.js";
import fs from 'node:fs/promises';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import path from "path";

export default class Builder {
    /**
     * @param {String} dest folder to build into
     * @returns {Builder} this
     */
    init(dest) {
        this.dest = dest;
        this.building = false;

        return this;
    }

    /**
     * 
     * @param {String} path directory path to cleanup
     */
    cleanup(path) {
        console.log("Builder: cleanup dir " + path)
        if (existsSync(path)){
            rmSync(path, { recursive: true, force: true });
        }
        mkdirSync(path, { recursive: true });
    }

    async copyDir(src, dest) {
        console.log(`Builder: copy dir ${src} > ${dest}`);
        let entries = await fs.readdir(src, { recursive: true, withFileTypes: true })
    
        for (let entry of entries) {
            let srcPath = path.join(entry.path, entry.name);
            let destPath = path.join(dest, entry.path, entry.name);
            let destDir = path.dirname(destPath);
            
            if (entry.isFile()) {
                await fs.mkdir(destDir, { recursive: true })
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * @param {String} path relative files path
     */
    async build(path) {
        this.building = true;
        this.cleanup(this.dest);
        await this.copyDir('res', this.dest);

        console.log("Builder: start build dir " + path)
        await build_js(path + "index.ts", this.dest);
        await build_less(path + "index.less", this.dest);
        await build_pug(path + "index.pug", this.dest);
        console.log("Builder: build finished.")
        this.building = false;
    }
}