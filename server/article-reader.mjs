import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import { isPublicAddress } from './rss-proxy.mjs';

const MAX_HTML_BYTES = 4 * 1024 * 1024;

function validateHttpsUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new Error('Use uma URL HTTPS pública válida.');
  }
  return url;
}

async function fetchPublicUrl(url, signal, redirects = 0, options = {}) {
  if (signal.aborted) throw new Error('Tempo limite excedido.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('O endereço deve pertencer à internet pública.');
  }
  const selected = addresses.find(({ family }) => family === 4) || addresses[0];

  const method = options.method || 'GET';
  const extraHeaders = options.headers || {};
  const bodyBuffer = options.body ? Buffer.from(options.body, 'utf-8') : null;

  const result = await new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        signal,
        family: selected.family,
        autoSelectFamily: false,
        lookup: (_h, _o, cb) => cb(null, selected.address, selected.family),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          ...(bodyBuffer ? { 'Content-Length': String(bodyBuffer.length) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.resume();
          resolve({ redirect: res.headers.location });
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_HTML_BYTES) {
            res.destroy(new Error('Página excede o limite de 4 MB.'));
          } else {
            chunks.push(chunk);
          }
        });
        res.on('error', reject);
        res.on('end', () =>
          resolve({
            finalUrl: url.href,
            bytes: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || '',
            encoding: res.headers['content-encoding'] || '',
          })
        );
      }
    );
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });

  if (result.redirect) {
    if (redirects >= 5) throw new Error('Redirecionamentos em excesso.');
    const nextUrl = validateHttpsUrl(new URL(result.redirect, url));
    return fetchPublicUrl(nextUrl, signal, redirects + 1);
  }

  let bytes = result.bytes;
  const limits = { maxOutputLength: MAX_HTML_BYTES };
  try {
    if (result.encoding === 'gzip' || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
      bytes = gunzipSync(bytes, limits);
    } else if (result.encoding === 'br') {
      bytes = brotliDecompressSync(bytes, limits);
    } else if (result.encoding === 'deflate') {
      bytes = inflateSync(bytes, limits);
    }
  } catch {
    // Mantém bytes originais se não estiver comprimido
  }

  const preview = bytes.subarray(0, 600).toString('ascii');
  const isLatin1 = /charset=["']?(?:iso-8859-1|windows-1252|latin1)/i.test(
    result.contentType + preview
  );
  const html = new TextDecoder(isLatin1 ? 'windows-1252' : 'utf-8').decode(bytes);
  return { html, finalUrl: result.finalUrl };
}

/**
 * Decodifica links do Google News RSS usando:
 * 1. Decodificação Base64 direta (links legados CBMi...)
 * 2. Endpoint batchexecute oficial do Google News (Fbv4je com data-n-a-sg e data-n-a-ts)
 * 3. Fallback de busca por título no Bing News RSS e DuckDuckGo HTML
 */
async function resolveGoogleNewsUrl(googleUrl, title, sourceName, signal) {
  const match = googleUrl.match(/\/articles\/([A-Za-z0-9_-]+)/);
  const articleId = match ? match[1] : null;

  // 1. Tenta extrair URL direta embutida em base64
  if (articleId) {
    try {
      const b64 = articleId.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = Buffer.from(b64, 'base64').toString('latin1');
      const urlMatch = decoded.match(/https:\/\/[a-zA-Z0-9./?=_%:-]+/);
      if (urlMatch && !urlMatch[0].includes('google.com')) {
        return validateHttpsUrl(urlMatch[0]);
      }
    } catch {
      // Continua
    }

    // 2. Decodifica via Google News batchexecute (Fbv4je)
    try {
      const splashUrl = validateHttpsUrl(
        `https://news.google.com/rss/articles/${articleId}`
      );
      const { html: splashHtml } = await fetchPublicUrl(splashUrl, signal);
      const sgMatch = splashHtml.match(/data-n-a-sg=["']([^"']+)["']/);
      const tsMatch = splashHtml.match(/data-n-a-ts=["']([^"']+)["']/);

      if (sgMatch && tsMatch) {
        const signature = sgMatch[1];
        const timestamp = Number(tsMatch[1]);
        const innerReq = JSON.stringify([
          'garturlreq',
          [
            [
              'pt-BR',
              'BR',
              ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'],
              null,
              null,
              1,
              1,
              'BR:pt-419',
              null,
              180,
              null,
              null,
              null,
              null,
              null,
              0,
              5,
            ],
            'pt-BR',
            'BR',
            1,
            [2, 3, 4, 8],
            1,
            0,
            '655000234',
            0,
            0,
            null,
            0,
          ],
          articleId,
          timestamp,
          signature,
        ]);

        const rpcBody = `f.req=${encodeURIComponent(
          JSON.stringify([[['Fbv4je', innerReq, null, 'generic']]])
        )}`;

        const batchUrl = validateHttpsUrl(
          'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je'
        );
        const { html: batchRes } = await fetchPublicUrl(batchUrl, signal, 0, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Referer: 'https://news.google.com/',
          },
          body: rpcBody,
        });

        const gartMatch = batchRes.match(
          /\\?"garturlres\\?",\\?"(https:\\?\/\\?\/[^"\\]+)\\?"/
        );
        if (gartMatch) {
          const cleanUrl = gartMatch[1]
            .replace(/\\\//g, '/')
            .replace(/\\u003d/gi, '=')
            .replace(/\\u0026/gi, '&');
          return validateHttpsUrl(cleanUrl);
        }
      }
    } catch {
      // Continua para fallback de busca por manchete
    }
  }

  // 3. Fallback: busca pela manchete limpa no Bing News RSS e DuckDuckGo HTML
  if (title) {
    const cleanSource = (sourceName || '')
      .replace(/[•|/-]/g, ' ')
      .replace(/\b(?:G1|Folha|Diário)\b/gi, '$&')
      .trim();

    for (const q of [title, `${title} ${cleanSource}`.trim()]) {
      try {
        const bingRssUrl = validateHttpsUrl(
          `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`
        );
        const { html: xml } = await fetchPublicUrl(bingRssUrl, signal);
        const urlParamMatch = xml.match(/[?&]url=(https%3a%2f%2f[^&<"]+)/i);
        if (urlParamMatch) {
          const decodedUrl = decodeURIComponent(urlParamMatch[1]);
          if (!decodedUrl.includes('google.com') && !decodedUrl.includes('bing.com')) {
            return validateHttpsUrl(decodedUrl);
          }
        }
      } catch {
        // Continua
      }
    }

    try {
      const ddgUrl = validateHttpsUrl(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(title)}`
      );
      const { html: ddgHtml } = await fetchPublicUrl(ddgUrl, signal);
      const uddgMatch = ddgHtml.match(/uddg=(https%3A%2F%2F[^&"']+)/i);
      if (uddgMatch) {
        const decodedUrl = decodeURIComponent(uddgMatch[1]);
        if (!decodedUrl.includes('google.com') && !decodedUrl.includes('duckduckgo.com')) {
          return validateHttpsUrl(decodedUrl);
        }
      }
    } catch {
      // Continua
    }
  }

  return validateHttpsUrl(googleUrl);
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([\da-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function stripTags(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Divide blocos de texto muito longos (ex: Metrópoles que envia tudo em um único bloco sem \n)
 * em parágrafos editoriais de 2 a 3 frases para leitura fluida.
 */
export function splitIntoEditorialParagraphs(text) {
  const cleaned = stripTags(text);
  if (!cleaned) return [];
  if (cleaned.length <= 420) return [cleaned];

  const sentences = cleaned.split(
    /(?<=[.!?]["”')\]}]?)\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ"“‘0-9])/
  );

  if (sentences.length <= 1) return [cleaned];

  const paragraphs = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
    } else if (current.length + trimmed.length + 1 <= 420) {
      current += ` ${trimmed}`;
    } else {
      paragraphs.push(current);
      current = trimmed;
    }
  }

  if (current) {
    paragraphs.push(current);
  }

  return paragraphs;
}

/**
 * Extrai metadados e corpo completo da matéria a partir do HTML público (JSON-LD + Tags Semânticas)
 */
export function extractReadableArticle(html) {
  // 1. Extrai imagem de capa (og:image / twitter:image)
  const ogImageMatch =
    html.match(
      /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i
    );
  let thumbnail = ogImageMatch ? decodeHtmlEntities(ogImageMatch[1].trim()) : undefined;
  if (
    thumbnail &&
    (!thumbnail.startsWith('https://') ||
      thumbnail.includes('googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc'))
  ) {
    thumbnail = undefined;
  }

  // 2. Extrai autor se disponível
  const authorMatch =
    html.match(
      /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i
    );
  let author = authorMatch ? stripTags(authorMatch[1]) : undefined;

  // 3. Tenta extrair articleBody de blocos JSON-LD (<script type="application/ld+json">)
  let jsonLdParagraphs = [];
  const ldMatches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  const findArticleBodyInObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(findArticleBodyInObject);
      return;
    }
    if (typeof obj.articleBody === 'string' && obj.articleBody.trim().length > 120) {
      const rawBody = decodeHtmlEntities(obj.articleBody.trim());
      const rawLines = rawBody
        .split(/\r?\n+/)
        .map((p) => stripTags(p))
        .filter((p) => p.length > 35);

      const expandedParts = rawLines.flatMap((line) =>
        splitIntoEditorialParagraphs(line)
      );

      if (expandedParts.length > jsonLdParagraphs.length) {
        jsonLdParagraphs = expandedParts;
      }
    }
    if (!author && obj.author) {
      const a = Array.isArray(obj.author) ? obj.author[0] : obj.author;
      if (typeof a === 'string') author = stripTags(a);
      else if (a && typeof a.name === 'string') author = stripTags(a.name);
    }
    if (!thumbnail && obj.image) {
      const img = Array.isArray(obj.image) ? obj.image[0] : obj.image;
      if (typeof img === 'string' && img.startsWith('https://')) thumbnail = img;
      else if (img && typeof img.url === 'string' && img.url.startsWith('https://')) {
        thumbnail = img.url;
      }
    }
    if (obj['@graph']) findArticleBodyInObject(obj['@graph']);
  };

  for (const match of ldMatches) {
    try {
      const cleanedJson = match[1].trim();
      if (cleanedJson) {
        findArticleBodyInObject(JSON.parse(cleanedJson));
      }
    } catch {
      // Ignora JSON-LD malformado
    }
  }

  // 4. Extrai parágrafos semânticos do HTML (<article>, <main> ou corpo limpo)
  let targetRegion = html;
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (articleMatch && articleMatch[1].length > 400) {
    targetRegion = articleMatch[1];
  } else if (mainMatch && mainMatch[1].length > 400) {
    targetRegion = mainMatch[1];
  }

  // Remove elementos de ruído (menus, rodapés, scripts, formulários, relacionados)
  const cleanedRegion = targetRegion
    .replace(/<(?:script|style|nav|header|footer|aside|form|noscript|svg|iframe|button)\b[\s\S]*?<\/(?:script|style|nav|header|footer|aside|form|noscript|svg|iframe|button)>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const blockMatches = cleanedRegion.matchAll(
    /<(p|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi
  );

  const boilerplateRegex =
    /^(?:leia mais|leia também|veja também|assine|receba nossas|siga o|todos os direitos reservados|copyright|este conteúdo|compartilhe|clique aqui para|baixe o app)/i;

  const htmlBlocks = [];
  const seenTexts = new Set();

  for (const [, tag, inner] of blockMatches) {
    const lowerTag = tag.toLowerCase();
    const text = stripTags(inner);
    if (!text) continue;

    if (lowerTag === 'p') {
      if (text.length < 45 || boilerplateRegex.test(text)) continue;
    } else if (text.length < 6 || text.length > 180 || boilerplateRegex.test(text)) {
      continue;
    }

    const normKey = text.toLowerCase();
    if (seenTexts.has(normKey)) continue;
    seenTexts.add(normKey);

    if (lowerTag === 'p' && text.length > 450) {
      const splitParas = splitIntoEditorialParagraphs(text);
      for (const sp of splitParas) {
        htmlBlocks.push(`<p>${escapeHtml(sp)}</p>`);
      }
    } else {
      htmlBlocks.push(`<${lowerTag}>${escapeHtml(text)}</${lowerTag}>`);
    }
  }

  const htmlTextLength = htmlBlocks.join(' ').length;
  const jsonLdTextLength = jsonLdParagraphs.join(' ').length;

  let finalBlocks = htmlBlocks;
  // Usa JSON-LD se o HTML semântico tiver pouco texto ou menos parágrafos
  if (
    jsonLdParagraphs.length > 0 &&
    (htmlBlocks.length < 2 || jsonLdTextLength > htmlTextLength * 1.15)
  ) {
    finalBlocks = jsonLdParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`);
  }

  return {
    contentHtml: finalBlocks.join('\n'),
    paragraphCount: finalBlocks.length,
    thumbnail,
    author,
  };
}

export default async function articleReader(req) {
  const headers = {
    'Cache-Control': 'public, max-age=600',
    'X-Content-Type-Options': 'nosniff',
  };

  if (req.method !== 'GET') {
    return Response.json(
      { error: 'Método não permitido.' },
      { status: 405, headers: { ...headers, Allow: 'GET' } }
    );
  }

  const reqUrl = new URL(req.url);
  const rawUrl = reqUrl.searchParams.get('url');
  const title = reqUrl.searchParams.get('title') || '';
  const sourceName = reqUrl.searchParams.get('source') || '';

  let targetUrl;
  try {
    if (!rawUrl || rawUrl.length > 2048) {
      throw new Error('Informe uma URL de matéria válida.');
    }
    targetUrl = validateHttpsUrl(rawUrl);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 400, headers: { ...headers, 'Cache-Control': 'no-store' } }
    );
  }

  const signal = AbortSignal.timeout(8500);

  try {
    if (targetUrl.hostname.includes('news.google.com')) {
      targetUrl = await resolveGoogleNewsUrl(
        targetUrl.href,
        title,
        sourceName,
        signal
      );
    }

    const { html, finalUrl } = await fetchPublicUrl(targetUrl, signal);
    const extracted = extractReadableArticle(html);

    return Response.json(
      {
        url: finalUrl,
        contentHtml: extracted.contentHtml,
        paragraphCount: extracted.paragraphCount,
        thumbnail: extracted.thumbnail,
        author: extracted.author,
      },
      { status: 200, headers }
    );
  } catch (error) {
    return Response.json(
      { error: error.message || 'Não foi possível extrair o artigo.' },
      { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } }
    );
  }
}

