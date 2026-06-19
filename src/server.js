const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const META_FILE = path.join(UPLOAD_DIR, 'meta.json');
const DEFAULT_TTL_HOURS = parseInt(process.env.DEFAULT_TTL_HOURS || '24', 10);
const MAX_TTL_HOURS = parseInt(process.env.MAX_TTL_HOURS || '168', 10);
const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveMeta(meta) {
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

let meta = loadMeta();

function deleteEntry(id) {
  const entry = meta[id];
  if (!entry) return;
  const filePath = path.join(UPLOAD_DIR, id, entry.storedName);
  fs.rm(path.join(UPLOAD_DIR, id), { recursive: true, force: true }, () => {});
  delete meta[id];
  saveMeta(meta);
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, entry] of Object.entries(meta)) {
    if (entry.expiresAt <= now) deleteEntry(id);
  }
}

cleanupExpired();
setInterval(cleanupExpired, 5 * 60 * 1000);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = uuidv4();
    req.uploadId = id;
    const dir = path.join(UPLOAD_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
});

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

function baseUrl(req) {
  return PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier fourni (champ "file" attendu).' });
  }

  let ttlHours = parseFloat(req.body.ttlHours) || DEFAULT_TTL_HOURS;
  if (ttlHours <= 0 || ttlHours > MAX_TTL_HOURS) ttlHours = DEFAULT_TTL_HOURS;

  const id = req.uploadId;
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;

  meta[id] = {
    storedName: req.file.originalname,
    originalName: req.file.originalname,
    size: req.file.size,
    expiresAt,
  };
  saveMeta(meta);

  const url = `${baseUrl(req)}/files/${id}`;
  res.json({
    url,
    expiresAt: new Date(expiresAt).toISOString(),
    curl: `curl -O -J ${url}`,
  });
});

app.get('/files/:id', (req, res) => {
  const entry = meta[req.params.id];
  if (!entry) return res.status(404).send('Fichier introuvable ou expiré.');
  if (entry.expiresAt <= Date.now()) {
    deleteEntry(req.params.id);
    return res.status(410).send('Ce lien a expiré.');
  }
  const filePath = path.join(UPLOAD_DIR, req.params.id, entry.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).send('Fichier introuvable.');
  res.download(filePath, entry.originalName);
});

app.listen(PORT, () => {
  console.log(`share-files en écoute sur le port ${PORT}`);
});
