import Builder from './builder.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
const upload = multer({ dest: "uploads/" });

const app = express()
const port = 3000

// application directory serve
app.use('/editor', express.static('./dist'));

// default reroute into /edior folder
app.get('/', async (req, res) => {
    res.redirect("/editor")
})

// server entry point
const server = app.listen(port, async() => {
  let builder = new Builder().init("./dist/");
  await builder.build();
  await builder.watch();

  console.log(`Digger server app listening on port ${port}`)
})

// files upload
app.post("/assets_upload", upload.array("files"), uploadFiles);

function uploadFiles(req, res) {
    console.log(req.body);
    console.log(req.files);
    res.redirect("/editor")
}

// -- dump

// Set up a headless websocket server that prints any
// events that come in.
const wsServer = new WebSocketServer({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => console.log(message));
});


server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
});