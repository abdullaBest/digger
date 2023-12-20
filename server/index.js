import Builder from './builder.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import Assets from './assets.js';
import path from 'path';

const port = 3000
const path_uploads = "uploads/";

const upload = multer({ dest: path_uploads });
const app = express()
const assets = new Assets();

// application directory serve
app.use('/editor', express.static('./dist'));

// default reroute into /edior folder
app.get('/', async (req, res) => {
    res.redirect("/editor")
})

// server entry point
const server = app.listen(port, async() => {
  let builder = new Builder().init("./dist/");
  await assets.init(path_uploads);
  await builder.build();
  await builder.watch();

  console.log(`Digger server app listening on port ${port}`)
})

// files upload
app.post("/assets/upload", upload.array("files"), uploadFiles);
app.post("/assets/upload/:id", upload.single("file"), updateFiles);

function updateFiles(req, res) {
  const id = req.params.id;
  const asset = assets.data[id];
  if (!asset) {
    res.statusCode = 500;
    res.send(`Asset ${id} wasn't found. Cant update`);
  }

  const file = req.file;
  const name = req.body.name;
  const extension = req.body.extension;

  if (file) {
    asset.filename = file.filename;
    asset.revision += 1;
    asset.revisions.push(file.filename);
  }
  if (name) {
    asset.name = name;
  }
  assets.save();

  res.send();
}

function uploadFiles(req, res) {
  //console.log(req.body);
  //console.log(req.files);
  for(const k in req.files) {
    const f = req.files[k];
    assets.register({
      id: f.filename, 
      filename: f.filename, 
      name: f.originalname, 
      type: f.mimetype, 
      size: f.size,
      extension: f.originalname.split('.').pop(),
    })
  }
  res.send();
}

// files access
app.get('/assets/list', async (req, res) => {
  res.json(Object.keys(assets.data));
})

app.get('/assets/get/:id', async (req, res) => {
  const id = req.params.id;
  const info = Object.assign(
    { url: `/assets/load/${id}` }, 
    assets.data[id]);
  res.json(info);
})

app.get('/assets/load/:id', async (req, res, next) => {
  const fileinfo = assets.data[req.params.id];
  const filename = fileinfo.filename;
  const options = {
    root: assets.directory,
    headers: {
      'Content-Type': fileinfo.type
    }
  }
  res.sendFile(filename, options, function (err) {
    if (!err) return; // file sent
    if (err.status !== 404) return next(err); // non-404 error
    // file for download not found
    res.statusCode = 404;
    res.send(`File ${req.params.id} not found`);
  });
})

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