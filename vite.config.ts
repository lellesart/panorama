import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function rssProxyPlugin(): Plugin {
  const responseCache = new Map<string, { xmlText: string; expiresAt: number }>();
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos de cache no servidor local

  const attachMiddleware = (middlewares: {
    use: (
      route: string,
      handler: (
        req: { url?: string },
        res: {
          statusCode: number;
          setHeader: (name: string, value: string) => void;
          end: (body?: string) => void;
        }
      ) => void
    ) => void;
  }) => {
    middlewares.use('/api/rss', async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '', 'http://localhost');
        const targetUrl = reqUrl.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing url parameter' }));
          return;
        }

        const cached = responseCache.get(targetUrl);
        if (cached && cached.expiresAt > Date.now()) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('X-Panorama-Cache', 'HIT');
          res.end(cached.xmlText);
          return;
        }

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept:
              'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.9',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(7500),
        });

        if (!response.ok) {
          res.statusCode = response.status;
          res.end(`Upstream HTTP ${response.status}`);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';
        const previewAscii = new TextDecoder('ascii').decode(
          arrayBuffer.slice(0, 250)
        );

        const isLatin1 =
          /iso-8859-1|windows-1252|latin1/i.test(contentType) ||
          /encoding=["'](?:iso-8859-1|windows-1252|latin1)["']/i.test(
            previewAscii
          );

        let xmlText = new TextDecoder(
          isLatin1 ? 'windows-1252' : 'utf-8'
        ).decode(arrayBuffer);

        if (isLatin1) {
          xmlText = xmlText.replace(
            /encoding=["'](?:iso-8859-1|windows-1252|latin1)["']/i,
            'encoding="UTF-8"'
          );
        }

        responseCache.set(targetUrl, {
          xmlText,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.setHeader('X-Panorama-Cache', 'MISS');
        res.end(xmlText);
      } catch (err) {
        res.statusCode = 502;
        res.end(err instanceof Error ? err.message : 'Proxy fetch error');
      }
    });
  };

  return {
    name: 'panorama-rss-proxy',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), rssProxyPlugin()],
});
