import fs from "fs";
import pug from "pug";
import less from "less";
import browserify from "browserify";
import babelify from "babelify";
import tsify from "tsify";

function write(file, text) {
  fs.writeFile(file, text, function (err) {
    if (err) return console.log(err);
  });
}

/**
 * @param {String} path index file path
 * @param {String} [dest="./dist/"] destination filter
 * @async
 */
function build_pug(path, dest = "./dist/") {
  console.log(`conventing: ${path} > ${dest}index.html...`);
  return new Promise((resolve, reject) => {
    const compiledFunction = pug.compileFile(path);
    write("./dist/index.html", compiledFunction({}));
    console.log("convented: ./index.pug > ./dist/index.html");
    resolve();
  })
}

/**
 * 
 * @param {String} path index file path
 * @param {String} [dest="./dist/"] destination filter
 * @async
 */
function build_less(path, dest = "./dist/") {
  console.log(`conventing: ${path} > ${dest}index.css...`);
  return new Promise((resolve, reject) => {
    fs.readFile(path, "utf8", function (err, data) {
      if (err) {
        return console.log(err);
      }
      less.render(data, {}).then(
        function (output) {
          write("./dist/index.css", output.css);
          console.log("convented: ./index.less > ./dist/index.css");
          resolve();
          // output.css = string of css
          // output.map = string of sourcemap
          // output.imports = array of string filenames of the imports referenced
        },
        function (error) {
          console.error(
            `convent error: (${path} > ${dest}index.css)`,
            error
          );
          reject();
        }
      );
    });
  })
}

/**
 * @param {String} path index file path
 * @param {String} [dest="./dist/"] destination filter
 * @async
 */
function build_js(path, dest = "./dist/") {
  console.log(`conventing: ${path} > ${dest}index.js...`);
  return new Promise((resolve, reject) => {
    browserify({ debug: true })
    .transform("babelify", { 
      presets: ["@babel/preset-env"]
    })
    .plugin(tsify)
    .transform("stringify", {
      appliesTo: { includeExtensions: [".hjs", ".html"] },
    })
    .require(path, { entry: true })
    .bundle()
    .on("error", function (err) {
      console.error(
        `convent error: (${path} > ${dest}index.js)`,
        err
      );
      reject();
    })
    .on("end", function () {
      console.log(`convented: ${path} > ${dest}index.css`);
      resolve();
    })
    .pipe(fs.createWriteStream("dist/index.js"));
})

  /*
  fs.copyFile("index.js", "dist/index.js", (err) => {
    if (err) throw err;
    console.log("copied: ./index.js > ./dist/index.js");
  });
  */
}

export {build_js, build_less, build_pug};