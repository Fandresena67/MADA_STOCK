const express = require('express');
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
app.use('/api/v1', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
