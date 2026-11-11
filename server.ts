/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Full-Stack Server for GEOLATINA — Industrial Latina S.A.
 * Provides server-side proxy route `/api/syspro/users` to connect with:
 * http://181.78.203.134:7070/api/syspro/users
 * preventing Mixed Content (HTTPS -> HTTP) and CORS issues in browser runtime.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Proxy endpoint for Syspro Users API: http://181.78.203.134:7070/api/syspro/users
  app.post('/api/syspro/users', async (req, res) => {
    try {
      const targetUrl = 'http://181.78.203.134:7070/api/syspro/users';
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (err: any) {
      console.error('Syspro proxy error:', err);
      return res.status(500).json({ error: err?.message || 'Error conectando con servidor Syspro' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GEOLATINA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
