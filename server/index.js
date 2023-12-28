import Builder from './builder.js';
import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import Assets from './assets.js';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import path from 'path';
import { rejects } from 'assert';

const port = 3000
const path_uploads = "uploads/";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!existsSync(path_uploads)){
      mkdirSync(path_uploads, { recursive: true });
    }
    cb(null, path_uploads)
  },
  filename: function (req, file, cb) {
    const id = req.params.id ?? assets.genId();
    let revision = 0;
    if (req.params.id && assets.get(req.params.id)) {
      const asset = assets.get(req.params.id);
      revision = asset.revision
    }
    cb(null, `${id}-${revision}`);
  }
})

const upload = multer({ dest: path_uploads, storage: storage });
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
app.post("/assets/upload/:id", upload.single("files"), updateFiles);
app.post("/assets/upload", upload.array("files"), uploadFiles);

function updateFiles(req, res) {
  const id = req.params.id;
  const asset = assets.get(id);
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
  const ids = [];
  for(const k in req.files) {
    const f = req.files[k];
    const id = f.filename;
    assets.register({
      id: id, 
      filename: f.filename, 
      name: f.originalname, 
      type: f.mimetype, 
      size: f.size,
      extension: f.originalname.split('.').pop(),
    })
    ids.push(id);
  }
  res.json(ids);
}

// files access
app.get('/assets/list', async (req, res) => {
  res.json(assets.keys());
})

app.get('/assets/get/:id', async (req, res) => {
  const id = req.params.id;
  const asset = assets.get(id);
  const revision = asset.revision;
  const info = Object.assign(
    { url: `/assets/load/${id}/${revision}` }, 
    asset);
  res.json(info);
})

app.get('/assets/load', async (req, res, next) => {
  let asset = null;

  // find asset matching query
  for(const k in assets.content.data) {
    const _asset = assets.content.data[k];
    let match = false;
    for (const q in req.query) {
      if (_asset[q] && _asset[q] == req.query[q]) {
        match = true;
      } else {
        match = false;
        break;
      }
    }

    if (match) {
      asset = _asset;
      break;
    }
  }

  if (!asset) {
    res.statusCode = 404;
    res.send("No asset matching query found.");
    return;
  }
  let filename = asset.filename;

  sendFile(filename, asset.type, res).catch((err)=>{
    if (err.status !== 404) return next(err); // non-404 error
    // file for download not found
    res.statusCode = 404;
    res.send("No file matching query found.");
  })
})

app.get('/assets/load/:id/:revision', async (req, res, next) => {
  const id = req.params.id;
  const revision = req.params.revision || -1;
  const asset = assets.get(id);

  const filename = asset.revisions[revision] || asset.revisions[asset.revision];

  sendFile(filename, asset.type, res).catch((err)=>{
    if (err.status !== 404) return next(err); // non-404 error
      // file for download not found
      res.statusCode = 404;
      res.send(`File ${id}  rev ${revision} not found`);
  })
})

function sendFile(filename, type,  res) {
  return new Promise((resolve, reject) => {
    const options = {
      root: assets.directory,
      headers: {
        'Content-Type': type
      }
    }
    res.sendFile(filename, options, function (err) {
      if (!err) {
        // file sent
        resolve();
      } else {
        reject(err);
      }
    });
  })
 
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