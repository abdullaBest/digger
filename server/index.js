import Builder from './builder.js';
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express()
const port = 3000

app.use('/editor', express.static('./dist'));

app.get('/', async (req, res) => {
    res.redirect("/editor")
})

// Set up a headless websocket server that prints any
// events that come in.
const wsServer = new WebSocketServer({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => console.log(message));
});

const server = app.listen(port, async() => {
  let builder = new Builder().init("./dist/");
  await builder.build();
  await builder.watch();

  console.log(`Digger server app listening on port ${port}`)
})

server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
});