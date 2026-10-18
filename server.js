'use strict';

const fs = require('fs');
const path = require('path');

// Wczytaj lokalną konfigurację środowiskową z .env
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      process.env[key] = val;
    }
  }
}

const express = require('express');
const api = require('./netlify/functions/api');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Raw text body parsing so Netlify functions receive event.body as string
app.use(express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '3mb' }));
app.use(express.text({ type: '*/*', limit: '10mb' }));

// Bridge API routes to Netlify functions handler
async function handleApi(req, res) {
  try {
    const binaryBody = Buffer.isBuffer(req.body);
    const rawBody = binaryBody ? req.body.toString('base64') : typeof req.body === 'string' ? req.body : (req.body ? JSON.stringify(req.body) : '');
    const event = {
      path: req.originalUrl,
      httpMethod: req.method,
      headers: req.headers,
      isBase64Encoded: binaryBody,
      body: rawBody
    };

    const result = await api.handler(event);

    res.status(result.statusCode || 200);

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }

    if (result.multiValueHeaders) {
      for (const [key, values] of Object.entries(result.multiValueHeaders)) {
        res.setHeader(key, values);
      }
    }

    res.send(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body);
  } catch (err) {
    console.error('Unhandled server error:', err);
    res.status(500).json({ message: 'Błąd serwera.' });
  }
}

app.use('/api', handleApi);
app.use('/.netlify/functions/api', handleApi);

// Specific rewrites from netlify.toml
app.get('/koordynator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/teren', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback for any unmatched non-API route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`AKP Commander server running on http://${HOST}:${PORT}`);
});
