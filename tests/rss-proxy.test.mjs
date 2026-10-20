import test from 'node:test';
import assert from 'node:assert/strict';
import rssProxy, { isPublicAddress } from '../server/rss-proxy.mjs';
import { extractReadableArticle } from '../server/article-reader.mjs';

test('accepts public addresses and rejects internal and mapped addresses', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1',
    '169.254.169.254', '100.100.100.200', '0.0.0.0', '224.0.0.1', '::1',
    '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2002:7f00:1::', 'not-an-ip']) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('rejects methods other than GET', async () => {
  const res = await rssProxy(new Request('https://panorama.test/api/rss', { method: 'POST' }));
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('Allow'), 'GET');
});

for (const url of ['', 'http://example.com/feed', 'file:///etc/passwd',
  'https://user:pass@example.com/feed', 'https://example.com:8443/feed', 'invalid']) {
  test(`rejects invalid feed URL: ${url || '(missing)'}`, async () => {
    const res = await rssProxy(new Request(`https://panorama.test/api/rss?url=${encodeURIComponent(url)}`));
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });
}

test('blocks an internal destination before opening an upstream connection', async () => {
  const res = await rssProxy(new Request('https://panorama.test/api/rss?url=https://127.0.0.1/feed'));
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /internet pública/);
});

test('extractReadableArticle extracts full paragraphs, og:image and author from HTML', () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:image" content="https://example.com/capa.jpg" />
        <meta name="author" content="Redação Panorama" />
      </head>
      <body>
        <article>
          <h2>Subtítulo da Reportagem</h2>
          <p>Este é o primeiro parágrafo completo da reportagem com mais de quarenta e cinco caracteres para validação do extrator.</p>
          <p>Este é o segundo parágrafo completo da matéria trazendo mais contexto jornalístico sobre o assunto em pauta.</p>
        </article>
      </body>
    </html>
  `;
  const result = extractReadableArticle(sampleHtml);
  assert.equal(result.thumbnail, 'https://example.com/capa.jpg');
  assert.equal(result.author, 'Redação Panorama');
  assert.equal(result.paragraphCount, 3);
  assert.match(result.contentHtml, /<h2>Subtítulo da Reportagem<\/h2>/);
});
