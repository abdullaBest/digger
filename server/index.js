import Builder from './builder.js';
import express from 'express';
import { WebSocketServer } from 'ws';

const app = express()
const port = 3000

app.use('/editor', express.static('./dist'));

let builder = new Builder().init("./dist/");

app.set('view engine', 'pug');
app.set('views', './server/views');
app.get('/', async (req, res) => {
    if (req.query.rebuild != null && !builder.building) {
        builder.build('./src/');
    } 
    
    res.render('index', { buildstatus: builder.building ? 'building' : 'built' });
})

app.get('/build', async (req, res) => {
    try {
        //res.write("building...");
        await builder.build('./src/');
        res.redirect("/editor")
    } catch (err) {
        console.error(err);
        res.send(err);
    }
})

// Set up a headless websocket server that prints any
// events that come in.
const wsServer = new WebSocketServer({ noServer: true });
wsServer.on('connection', socket => {
  socket.on('message', message => console.log(message));
});

const server = app.listen(port, () => {
  console.log(`Degger server app listening on port ${port}`)
})

server.on('upgrade', (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
      wsServer.emit('connection', socket, request);
    });
  });