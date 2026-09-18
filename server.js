import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

// Proxy API, evidence, and uploads to FastAPI backend if available
app.use(['/api', '/evidence', '/uploads'], async (req, res) => {
  try {
    const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;

    const options = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = req;
      options.duplex = 'half';
    }

    const proxyRes = await fetch(targetUrl, options);
    res.status(proxyRes.status);
    proxyRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (proxyRes.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(proxyRes.body);
      nodeStream.on('error', (e) => {
        if (!res.headersSent) res.status(500).end();
      });
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Proxy error connecting to backend', details: err.message });
    }
  }
});

// Serve built static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback for React Router / client routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BorderVision AI UI running on http://0.0.0.0:${PORT}`);
});
