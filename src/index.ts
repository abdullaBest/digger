function main() {
    console.warn('231518 test app ran.');
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