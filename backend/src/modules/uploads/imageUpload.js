const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Stockage d'images local partagé (avatars utilisateurs, photos produits).
// - DB : référence publique uniquement, jamais le binaire ;
// - nom serveur UUID + extension prouvée, jamais le nom client ;
// - un store par usage (dossiers et préfixes URL séparés).

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// UUID v4 (crypto.randomUUID) + extension sûre : seuls nos fichiers sont effaçables.
const MANAGED_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

function badRequest(msg = 'Fichier invalide.') {
  const err = new Error(msg);
  err.status = 400;
  return err;
}

/**
 * Détecte le vrai format par magic bytes (ne jamais croire extension/MIME clients).
 * Retourne l'extension sûre à utiliser, ou null.
 */
function sniffImageExtension(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return '.png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  return null;
}

function mimeForExtension(ext) {
  if (ext === '.jpg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'image/webp';
}

/** Garde multer : mémoire + 5 Mo + MIME/extension déclarés (le contenu est revérifié au save). */
function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!IMAGE_MIME.has(file.mimetype) || !IMAGE_EXT.has(ext)) {
    const err = new Error('Format non pris en charge. Utilisez JPG, PNG ou WEBP.');
    err.status = 400;
    return cb(err);
  }
  return cb(null, true);
}

/** Traduit les erreurs multer en erreurs métier françaises. */
function mapUploadError(err) {
  if (!err) return null;
  if (err.code === 'LIMIT_FILE_SIZE') {
    const tooBig = new Error('La photo ne doit pas dépasser 5 Mo.');
    tooBig.status = 413;
    return tooBig;
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const badField = new Error('Aucune photo fournie.');
    badField.status = 400;
    return badField;
  }
  return err; // fileFilter (statut déjà positionné) ou autre
}

/**
 * Middleware d'upload partagé (avatars + produits) : mémoire d'abord, rien
 * n'est écrit sur disque avant validation par le service (magic bytes).
 */
function singleImageUpload(field) {
  const multer = require('multer');
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
    fileFilter: imageFileFilter,
  });
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      return next(mapUploadError(err));
    });
  };
}

function makeImageStore({ dir, urlPrefix }) {
  fs.mkdirSync(dir, { recursive: true });

  function publicUrl(filename) {
    return `${urlPrefix}${filename}`;
  }

  /** Écrit le fichier APRÈS validation (buffer multer memoryStorage). */
  async function save(file) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw badRequest('Aucune photo fournie.');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const err = new Error('La photo ne doit pas dépasser 5 Mo.');
      err.status = 413;
      throw err;
    }
    const ext = sniffImageExtension(file.buffer);
    // MIME déclaré + contenu réel doivent concorder (anti-spoofing).
    if (!ext || !IMAGE_MIME.has(file.mimetype) || file.mimetype !== mimeForExtension(ext)) {
      throw badRequest('Format non pris en charge. Utilisez JPG, PNG ou WEBP.');
    }
    const filename = `${crypto.randomUUID()}${ext}`;
    await fs.promises.writeFile(path.join(dir, filename), file.buffer);
    return { filename, url: publicUrl(filename) };
  }

  /** Supprime un fichier local — uniquement si l'URL correspond à un fichier géré. */
  async function removeForUrl(fileUrl) {
    if (!fileUrl || typeof fileUrl !== 'string') return;
    if (!fileUrl.startsWith(urlPrefix)) return;
    const filename = fileUrl.slice(urlPrefix.length);
    if (!MANAGED_FILE_RE.test(filename)) return;
    try {
      await fs.promises.unlink(path.join(dir, filename));
    } catch (e) {
      if (e.code !== 'ENOENT') console.error('[upload] suppression ancien fichier impossible:', e.message);
    }
  }

  return { save, removeForUrl, dir, urlPrefix };
}

module.exports = {
  MAX_IMAGE_SIZE,
  IMAGE_MIME,
  IMAGE_EXT,
  imageFileFilter,
  mapUploadError,
  singleImageUpload,
  sniffImageExtension,
  makeImageStore,
};
