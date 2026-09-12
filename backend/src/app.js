const express = require('express');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimit');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    // Whitelist stricte : jamais '*' avec authentification.
    origin: (origin, cb) => {
      const allowed = env.frontendUrl.split(',').map((s) => s.trim());
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('Origine CORS non autorisée'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
// Photos de profil : fichiers gérés serveur (UUID), lecture publique par URL non devinable.
// express.static neutralise le path traversal (résolution confinée à la racine).
const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(avatarsDir, { recursive: true });
// Photos produits : dossier séparé des avatars (même politique : UUID non devinables).
const productImagesDir = path.join(__dirname, '..', 'uploads', 'products');
fs.mkdirSync(productImagesDir, { recursive: true });
// Logos entreprise : dossier dédié (jamais mélangé avatars/produits).
const logosDir = path.join(__dirname, '..', 'uploads', 'logos');
fs.mkdirSync(logosDir, { recursive: true });
const publicImageStatic = (dir) =>
  express.static(dir, {
    dotfiles: 'deny',
    index: false,
    maxAge: '7d',
    setHeaders: (res) => {
      // Asset public par URL non devinable (UUID) : autorise l'embedding <img>
      // cross-origin (frontend :5173/5174 vs API :5000). Sans cela, le
      // Cross-Origin-Resource-Policy: same-origin global de helmet fait échouer
      // le chargement et l'UI retombe sur le fallback (initiales / icône).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });
app.use('/uploads/avatars', publicImageStatic(avatarsDir));
app.use('/uploads/products', publicImageStatic(productImagesDir));
app.use('/uploads/logos', publicImageStatic(logosDir));
app.use('/api/v1', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
