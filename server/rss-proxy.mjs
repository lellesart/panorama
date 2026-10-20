import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';

const MAX_BYTES = 3 * 1024 * 1024;

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)));
  }
  // Only globally routable IPv6; excludes loopback, mapped IPv4 and local networks.
  if (isIP(address) === 6) {
    const first = parseInt(address.split(':')[0], 16);
    return first >= 0x2000 && first <= 0x3fff &&
      !/^2001:(?:0*0:|0*2:|0*10:|0*db8:)/i.test(address) &&
      !/^2002:/i.test(address);
  }
  return false;
}

function validateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443')) {
    throw new Error('Use uma URL HTTPS pública, sem credenciais ou porta personalizada.');
  }
  return url;
}

// Resolve and pin the public address for every redirect, preventing SSRF and DNS rebinding.
async function requestPublicFeed(url, signal, redirects = 0) {
  if (signal.aborted) throw new Error('Tempo limite de consulta excedido.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('O endereço do feed deve pertencer à internet pública.');
  }
  const selected = addresses.find(({ family }) => family === 4) || addresses[0];
  const result = await new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      family: selected.family,
      autoSelectFamily: false,
      lookup: (_hostname, _options, callback) => callback(null, selected.address, selected.family),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PanoramaRSS/1.0)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve({ redirect: res.headers.location });
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`O portal retornou HTTP ${res.statusCode}.`));
        return;
      }
      let size = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          res.destroy(new Error('O feed excede o limite de 3 MB.'));
        } else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({
        bytes: Buffer.concat(chunks),
        contentType: res.headers['content-type'] || '',
        encoding: res.headers['content-encoding'] || '',
      }));
    });
    req.on('error', reject);
    req.end();
  });
  if (result.redirect) {
    if (redirects >= 4) throw new Error('Redirecionamentos demais no feed.');
    return requestPublicFeed(validateUrl(new URL(result.redirect, url)), signal, redirects + 1);
  }
  // Some publishers send gzip even when identity was requested.
  let bytes = result.bytes;
  const limits = { maxOutputLength: MAX_BYTES };
  if (result.encoding === 'gzip' || (bytes[0] === 0x1f && bytes[1] === 0x8b)) {
    bytes = gunzipSync(bytes, limits);
  } else if (result.encoding === 'br') {
    bytes = brotliDecompressSync(bytes, limits);
  } else if (result.encoding === 'deflate') {
    bytes = inflateSync(bytes, limits);
  }
  const preview = bytes.subarray(0, 300).toString('ascii');
  const latin1 = /iso-8859-1|windows-1252|latin1/i.test(result.contentType + preview);
  const xml = new TextDecoder(latin1 ? 'windows-1252' : 'utf-8').decode(bytes);
  if (!/<(?:rss|feed|(?:\w+:)?RDF)[\s>]/i.test(xml)) {
    throw new Error('O portal não retornou um feed RSS ou Atom válido.');
  }
  return xml.replace(/encoding=["'](?:iso-8859-1|windows-1252|latin1)["']/i, 'encoding="UTF-8"');
}

export default async function rssProxy(req) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (req.method !== 'GET') {
    return Response.json({ error: 'Método não permitido.' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  const value = new URL(req.url).searchParams.get('url');
  let url;
  try {
    if (!value || value.length > 2048) throw new Error('Informe uma URL de feed válida.');
    url = validateUrl(value);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers });
  }
  try {
    const xml = await requestPublicFeed(url, AbortSignal.timeout(8000));
    return new Response(xml, { headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 502, headers });
  }
}
