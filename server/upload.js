import multer from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import Assets from './assets.js';

const assets = Assets.instance();

const path_uploads = "uploads/";
const path_uploads_thumbnails = "thumbnails/";

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
      revision = asset.revision ?? 0
    }

    let name = id;
    if (revision) {
      name = `${id}-${revision}`;
    }
    
    cb(null, name);
  }
})

const storage_thumbnail = multer.diskStorage({
    destination: function (req, file, cb) {
        const path = path_uploads + path_uploads_thumbnails;
      if (!existsSync(path)){
        mkdirSync(path, { recursive: true });
      }
      cb(null, path)
    },
    filename: function (req, file, cb) {
      const id = req.params.id;
      if (!id) {
        cb(null, false);
      }
      
      cb(null, id);
    }
})

const upload = multer({ dest: path_uploads, storage: storage });
const upload_thumbnail = multer({ dest: path_uploads_thumbnails, storage: storage_thumbnail });

export { upload, upload_thumbnail, path_uploads, path_uploads_thumbnails }