import {Parcel} from '@parcel/core';
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

        this.bundler = new Parcel({
            entries: './src/index.pug',
            defaultConfig: '@parcel/config-default',
            targets: {
                default: {
                  distDir: this.dest,
                  publicUrl: "./",
                  engines: {
                    browsers: ['> 0.5%, last 2 versions, not dead']
                  }
                }
              },
          });

        return this;
    }

    /**
     * @param {String} path directory path to cleanup
     */
    cleanup(path) {
        console.log("Builder: cleanup dir " + path)
        if (existsSync(path)){
            rmSync(path, { recursive: true, force: true });
        }
        mkdirSync(path, { recursive: true });
    }

    /**
     * @param {String} src srt folder
     * @param {String} dest destination folder
     */
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
     * Starts to watch source folder
     * @async
     */
    async watch() {
        console.log("Builder: start watching sources");
        this.subscription = await this.bundler.watch((err, event) => {
            if (err) {
                // fatal error
                throw err;
            }
            
            if (event.type === 'buildSuccess') {
                let bundles = event.bundleGraph.getBundles();
                console.log(`✨ Built ${bundles.length} bundles in ${event.buildTime}ms!`);
            } else if (event.type === 'buildFailure') {
                console.log(event.diagnostics);
            }
        });
    }

    /**
     * Stops to watch source folder
     * @async
     */
    async stop() {
        console.log("Builder: stop watching sources");
        await this.subscription.unsubscribe();
    }

    /**
     * runs bundler unce
     * @async
     */
    async build() {
        console.log("Builder: start build")

        this.cleanup(this.dest);
        await this.copyDir('res', this.dest);
        
        // https://parceljs.org/features/parcel-api/
        try {
            let {bundleGraph, buildTime} = await this.bundler.run();
            let bundles = bundleGraph.getBundles();
            console.log(`✨ Built ${bundles.length} bundles in ${buildTime}ms!`);
        } catch (err) {
            console.log(err.diagnostics);
        }

        console.log("Builder: build finished.")
    }
}