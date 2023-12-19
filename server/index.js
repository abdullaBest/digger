import Builder from './builder.js';
import express from 'express';
const app = express()
const port = 3000

let builder = new Builder().init("./dist/");

app.get('/', async (req, res) => {
    try {
        await builder.build('./src/');
        res.send("built!");
    } catch (err) {
        console.error(err);
        res.send(err);
    }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.use('/editor', express.static('./dist'))