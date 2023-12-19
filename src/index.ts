import App from "./app"

function main() {
    const app = new App();
    app.init().run();
}


document.addEventListener('readystatechange', event => {
    switch (document.readyState) {
      case "loading":
        break;
      case "interactive":
        break;
      case "complete":
          main();
        break;
    }
  });