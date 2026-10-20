import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import rssProxy from './server/rss-proxy.mjs';

function rssProxyPlugin(): Plugin {
  const attach = (server: { middlewares: { use: (...args: any[]) => void } }) => {
    server.middlewares.use('/api/rss', async (req: any, res: any) => {
      try {
        const response = await rssProxy(new Request(
          new URL(req.url || '', 'http://localhost/api/rss').href,
          { method: req.method || 'GET' }
        ));
        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(await response.text());
      } catch {
        res.statusCode = 502;
        res.end('Não foi possível consultar o feed.');
      }
    });
  };
  return { name: 'panorama-rss-proxy', configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig({ plugins: [react(), rssProxyPlugin()] });
