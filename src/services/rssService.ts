import { Article, FeedSource, Rss2JsonItem, Rss2JsonResponse } from '../types/news';

const LOCAL_PROXY_ENDPOINT = '/api/rss?url=';
const RSS2JSON_ENDPOINT = 'https://api.rss2json.com/v1/api.json?rss_url=';
const CODETABS_PROXY_ENDPOINT = 'https://api.codetabs.com/v1/proxy?quest=';
const ALLORIGINS_RAW_ENDPOINT = 'https://api.allorigins.win/raw?url=';
const CORSPROXY_ENDPOINT = 'https://corsproxy.io/?url=';

const MAX_ITEMS_PER_FEED = 20;
const CONCURRENCY_LIMIT = 8;
const FETCH_TIMEOUT_MS = 10000; // Inclui o tempo de consulta e inicialização do servidor
const EDITION_STORAGE_KEY = 'panorama-cached-edition-v1';

let isLocalProxyActive = true;
export interface FeedLoadStatus {
  completed: number;
  total: number;
  failedSources: string[];
}

/**
 * Lê a última edição salva no localStorage para exibição instantânea (0ms) ao abrir o site
 */
export function getInitialCachedEdition(): Article[] {
  try {
    const raw = localStorage.getItem(EDITION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 &&
      Array.isArray(parsed.articles) ? parsed.articles : [];
  } catch {
    return [];
  }
}

function saveCachedEdition(articles: Article[]): void {
  try {
    localStorage.setItem(
      EDITION_STORAGE_KEY,
      JSON.stringify({ savedAt: Date.now(), articles: articles.slice(0, 300) })
    );
  } catch {
    // Ignora caso localStorage esteja cheio
  }
}

/**
 * Remove tags HTML e entidades comuns para gerar o resumo limpo (contentSnippet)
 */
function stripHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Tenta extrair a primeira imagem de um bloco HTML caso o item RSS não traga thumbnail explícita
 */
function extractImageFromHtml(html: string): string | undefined {
  if (!html) return undefined;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (
    imgMatch &&
    imgMatch[1] &&
    !imgMatch[1].includes('1x1') &&
    !imgMatch[1].includes('pixel') &&
    !imgMatch[1].includes('googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc')
  ) {
    return imgMatch[1];
  }
  return undefined;
}

/**
 * Normaliza a data de publicação para ISO string válida (incluindo datas em português do UOL e formato DD/MM/YYYY)
 */
function normalizeDate(pubDate: string, fallbackIndex = 0): string {
  const fallbackPastDate = () =>
    new Date(Date.now() - (fallbackIndex + 2) * 45 * 60 * 1000).toISOString();

  if (!pubDate || !pubDate.trim()) {
    return fallbackPastDate();
  }

  let str = pubDate.trim();

  // Formato brasileiro: DD/MM/YYYY HH:mm ou DD/MM/YYYY HHhMM
  const brMatch = str.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:[\sT,-]+(\d{2})[:h](\d{2})(?::(\d{2}))?)?/
  );
  if (brMatch) {
    const [, day, month, year, hour = '12', min = '00', sec = '00'] = brMatch;
    const brDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}-03:00`);
    if (!isNaN(brDate.getTime())) {
      return brDate.toISOString();
    }
  }

  // Traduz dias da semana e meses em português (ex: "Ter, 20 Out 2026 07:30:00 -0300" no UOL)
  str = str
    .replace(/^(seg|ter|qua|qui|sex|s[áa]b|dom)[a-z-]*,?\s+/i, '')
    .replace(/\bFev\b/gi, 'Feb')
    .replace(/\bAbr\b/gi, 'Apr')
    .replace(/\bMai\b/gi, 'May')
    .replace(/\bAgo\b/gi, 'Aug')
    .replace(/\bSet\b/gi, 'Sep')
    .replace(/\bOut\b/gi, 'Oct')
    .replace(/\bDez\b/gi, 'Dec');

  let parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    parsed = new Date(str.replace(' ', 'T'));
  }

  if (!isNaN(parsed.getTime())) {
    // Se a data veio no futuro por erro de fuso horário do portal, ajusta para o passado recente
    if (parsed.getTime() > Date.now() + 60 * 1000) {
      const adjusted = new Date(parsed.getTime() - 3 * 60 * 60 * 1000);
      return adjusted.getTime() <= Date.now()
        ? adjusted.toISOString()
        : fallbackPastDate();
    }
    return parsed.toISOString();
  }

  return fallbackPastDate();
}

/**
 * Limpa resumos vindos do Google News RSS que apenas repetem o título + nome do portal
 */
function cleanSnippetText(snippet: string, cleanTitle: string, sourceName: string): string {
  if (!snippet) return '';
  let text = snippet.trim();

  // Caso o snippet seja basicamente o próprio título repetido (padrão Google News RSS)
  if (
    text === cleanTitle ||
    text.startsWith(cleanTitle) && text.length <= cleanTitle.length + sourceName.length + 25
  ) {
    return `Cobertura atualizada em ${sourceName}. Clique para abrir a leitura ou acessar a matéria original.`;
  }

  return text.length > 260 ? `${text.slice(0, 260)}...` : text;
}

/**
 * Normaliza um item retornado pela API rss2json para a interface Article
 */
function normalizeArticle(
  item: Rss2JsonItem,
  source: FeedSource,
  index = 0
): Article {
  const rawHtml = item.content || item.description || '';
  const rawTitle = stripHtml(item.title) || 'Sem título';
  const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
  const rawSnippet = stripHtml(item.description || item.content || '');
  const snippet = cleanSnippetText(rawSnippet, cleanTitle, source.name);

  const thumbnail =
    item.thumbnail ||
    (item.enclosure?.type?.startsWith('image') ? item.enclosure.link : undefined) ||
    extractImageFromHtml(rawHtml);

  const uniqueKey = item.guid || item.link || `${source.id}-${cleanTitle}`;

  return {
    id: `${source.id}::${uniqueKey}`,
    title: cleanTitle,
    link: item.link || source.url,
    pubDate: normalizeDate(item.pubDate, index),
    contentSnippet: snippet,
    contentHtml: rawHtml || `<p>${snippet}</p>`,
    thumbnail: thumbnail && thumbnail.startsWith('http') ? thumbnail : undefined,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    color: source.color,
    author: item.author ? stripHtml(item.author) : undefined,
  };
}

/**
 * Sanitiza entidades HTML soltas em XML (ex: &nbsp;, & comercial sem escape)
 */
function sanitizeXmlString(xml: string): string {
  return xml
    .replace(/^\uFEFF/, '')
    .replace(/&nbsp;/gi, '&#160;')
    .replace(/&(?!(?:apos|quot|[gl]t|amp|#\d+|#x[\da-fA-F]+);)/g, '&amp;');
}

/**
 * Faz o parse de XML RSS/Atom diretamente no navegador com tolerância a falhas de XML
 */
function parseXmlFeed(xmlText: string, source: FeedSource): Article[] {
  if (!xmlText || !xmlText.trim()) return [];

  const parser = new DOMParser();
  let xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  let items = Array.from(xmlDoc.querySelectorAll('item, entry'));

  // Se houve erro de parse estrito no XML, tenta novamente sanitizando entidades
  if (items.length === 0 || xmlDoc.querySelector('parsererror')) {
    const sanitized = sanitizeXmlString(xmlText);
    xmlDoc = parser.parseFromString(sanitized, 'text/xml');
    items = Array.from(xmlDoc.querySelectorAll('item, entry'));
  }

  return items.slice(0, MAX_ITEMS_PER_FEED).map((node, index) => {
    const rawTitle = node.querySelector('title')?.textContent || 'Sem título';
    const strippedTitle = stripHtml(rawTitle);
    const cleanTitle = strippedTitle.replace(/\s+-\s+[^-]+$/, '').trim() || strippedTitle;

    // Extrai link de <link href="..."> (Atom) ou <link>...</link> (RSS 2.0)
    let link = '';
    const linkNodes = Array.from(node.querySelectorAll('link'));
    for (const ln of linkNodes) {
      const href = ln.getAttribute('href');
      const rel = ln.getAttribute('rel');
      if (href && (!rel || rel === 'alternate')) {
        link = href.trim();
        break;
      }
      if (ln.textContent?.trim()) {
        link = ln.textContent.trim();
        break;
      }
    }
    if (!link) link = source.url;

    const pubDate =
      node.querySelector('pubDate')?.textContent ||
      node.querySelector('published')?.textContent ||
      node.querySelector('updated')?.textContent ||
      node.getElementsByTagNameNS('*', 'date')[0]?.textContent ||
      '';

    const description =
      node.querySelector('description')?.textContent ||
      node.querySelector('summary')?.textContent ||
      '';
    const contentEncoded =
      node.getElementsByTagNameNS('*', 'encoded')[0]?.textContent ||
      node.querySelector('content')?.textContent ||
      description;

    const mediaContent =
      node.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('url') ||
      node.getElementsByTagNameNS('*', 'thumbnail')[0]?.getAttribute('url') ||
      node.querySelector('enclosure[type^="image"]')?.getAttribute('url') ||
      node.querySelector('enclosure')?.getAttribute('url') ||
      extractImageFromHtml(contentEncoded || description);

    const author =
      node.querySelector('author name')?.textContent ||
      node.getElementsByTagNameNS('*', 'creator')[0]?.textContent ||
      node.querySelector('author')?.textContent ||
      undefined;

    const rawSnippet = stripHtml(description || contentEncoded);
    const snippet = cleanSnippetText(rawSnippet, cleanTitle, source.name);

    const uniqueKey =
      node.querySelector('guid')?.textContent?.trim() ||
      node.querySelector('id')?.textContent?.trim() ||
      link ||
      `${source.id}-${cleanTitle}`;

    return {
      id: `${source.id}::${uniqueKey}`,
      title: cleanTitle,
      link,
      pubDate: normalizeDate(pubDate, index),
      contentSnippet: snippet,
      contentHtml: contentEncoded || `<p>${snippet}</p>`,
      thumbnail:
        mediaContent && mediaContent.startsWith('http') ? mediaContent : undefined,
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      color: source.color,
      author: author ? stripHtml(author) : undefined,
    };
  });
}

async function fetchViaLocalProxy(feedUrl: string, source: FeedSource): Promise<Article[]> {
  if (!isLocalProxyActive) {
    throw new Error('Local proxy inactive');
  }

  const encodedUrl = encodeURIComponent(feedUrl.trim());
  const response = await fetch(`${LOCAL_PROXY_ENDPOINT}${encodedUrl}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Proxy local HTTP ${response.status}`);
  }

  const xmlText = await response.text();

  // Caso o servidor Vite não tenha sido reiniciado e retorne o index.html (SPA fallback)
  if (
    xmlText.trimStart().startsWith('<!DOCTYPE html') ||
    xmlText.includes('<div id="root"></div>')
  ) {
    isLocalProxyActive = false;
    throw new Error('Local proxy returned SPA index.html');
  }

  const parsed = parseXmlFeed(xmlText, source);

  if (parsed.length === 0) {
    throw new Error(`Zero artigos extraídos do XML em ${source.name}`);
  }

  return parsed;
}

async function fetchViaRss2Json(feedUrl: string, source: FeedSource): Promise<Article[]> {
  // rss2json rejeita URLs de busca do Google News
  if (feedUrl.includes('news.google.com')) {
    throw new Error('Skip rss2json for Google News URL');
  }

  const encodedUrl = encodeURIComponent(feedUrl.trim());
  const response = await fetch(`${RSS2JSON_ENDPOINT}${encodedUrl}`, {
    signal: AbortSignal.timeout(3500),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha HTTP ${response.status}`);
  }

  const data: Rss2JsonResponse = await response.json();

  if (data.status !== 'ok' || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(`Resposta vazia do conversor RSS para ${source.name}`);
  }

  return data.items
    .slice(0, MAX_ITEMS_PER_FEED)
    .map((item, idx) => normalizeArticle(item, source, idx));
}

async function fetchViaExternalXmlProxy(
  proxyBase: string,
  feedUrl: string,
  source: FeedSource
): Promise<Article[]> {
  const encodedUrl = encodeURIComponent(feedUrl.trim());
  const response = await fetch(`${proxyBase}${encodedUrl}`, {
    signal: AbortSignal.timeout(3500),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Falha no proxy externo HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  const parsed = parseXmlFeed(xmlText, source);

  if (parsed.length === 0) {
    throw new Error(`Nenhum item XML encontrado para ${source.name}`);
  }

  return parsed;
}

/**
 * Busca um único feed RSS tentando:
 * Consulta o endpoint próprio (Vite/Netlify) nas URLs principal e secundária.
 * Depois tenta conversores e proxies públicos se o portal não responder.
 */
export async function fetchSingleFeed(source: FeedSource): Promise<Article[]> {
  const urlsToTry = [source.url, source.fallbackUrl].filter(Boolean) as string[];

  for (const candidateUrl of urlsToTry) {
    // Endpoint próprio, disponível tanto localmente como no Netlify.
    try {
      const articles = await fetchViaLocalProxy(candidateUrl, source);
      return articles;
    } catch {
      // Continua para os fallbacks externos
    }
  }

  for (const candidateUrl of urlsToTry) {
    // 2. Tenta rss2json
    try {
      const articles = await fetchViaRss2Json(candidateUrl, source);
      return articles;
    } catch {
      // Continua
    }

    // 3. Tenta proxies XML externos (CodeTabs, AllOrigins, CorsProxy)
    for (const proxyBase of [
      CODETABS_PROXY_ENDPOINT,
      ALLORIGINS_RAW_ENDPOINT,
      CORSPROXY_ENDPOINT,
    ]) {
      // corsproxy.io bloqueia domínio google.com no plano gratuito
      if (proxyBase === CORSPROXY_ENDPOINT && candidateUrl.includes('google.com')) {
        continue;
      }
      try {
        const articles = await fetchViaExternalXmlProxy(
          proxyBase,
          candidateUrl,
          source
        );
        return articles;
      } catch {
        // Continua
      }
    }
  }

  console.warn(`[Panorama] Não foi possível carregar o feed "${source.name}".`);
  return [];
}

/**
 * Intercala artigos após ordenação cronológica para evitar que um único portal
 * (ex: UOL ou G1 com 6 matérias no mesmo minuto) monopolize o topo de "Todas as Notícias"
 */
function interleaveArticlesBySource(sortedArticles: Article[]): Article[] {
  const result: Article[] = [];
  const remaining = [...sortedArticles];

  while (remaining.length > 0) {
    const lastSourceId = result.length > 0 ? result[result.length - 1].sourceId : null;

    // Busca o próximo artigo mais recente que não seja do mesmo portal do anterior
    const nextDiffIndex = remaining.findIndex(
      (art) => art.sourceId !== lastSourceId
    );

    if (nextDiffIndex !== -1 && nextDiffIndex <= 8) {
      result.push(remaining.splice(nextDiffIndex, 1)[0]);
    } else {
      result.push(remaining.shift()!);
    }
  }

  return result;
}

/**
 * Busca todos os feeds ativos com carregamento progressivo (streaming):
 * Assim que os primeiros portais respondem (~300ms), já atualiza a tela via onProgress
 * sem esperar os 32 portais terminarem.
 */
export async function fetchAllActiveFeeds(
  sources: FeedSource[],
  onProgress?: (partialArticles: Article[]) => void,
  onStatus?: (status: FeedLoadStatus) => void
): Promise<Article[]> {
  const enabledSources = sources.filter((source) => source.enabled);

  const failedSources: string[] = [];
  const reportStatus = (completed: number) => onStatus?.({
    completed, total: enabledSources.length, failedSources: [...failedSources],
  });
  reportStatus(0);
  if (enabledSources.length === 0) {
    return [];
  }

  const allArticles: Article[] = [];
  const queue = [...enabledSources];
  let completedFeeds = 0;

  const emitProgress = () => {
    if (!onProgress || allArticles.length === 0) return;
    const sortedPartial = [...allArticles].sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
    onProgress(interleaveArticlesBySource(sortedPartial));
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY_LIMIT, queue.length) },
    async () => {
      while (queue.length > 0) {
        const nextSource = queue.shift();
        if (!nextSource) break;
        const articles = await fetchSingleFeed(nextSource);
        completedFeeds += 1;
        if (articles.length === 0) failedSources.push(nextSource.name);
        reportStatus(completedFeeds);
        if (articles.length > 0) {
          allArticles.push(...articles);
          // Dispara atualização visual imediata nos primeiros portais e a cada 3 portais concluídos
          if (completedFeeds <= 3 || completedFeeds % 3 === 0) {
            emitProgress();
          }
        }
      }
    }
  );

  await Promise.all(workers);

  // Ordenação decrescente por data de publicação + intercalação editorial entre portais
  const sorted = allArticles.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  const finalArticles = interleaveArticlesBySource(sorted);
  onProgress?.(finalArticles);
  saveCachedEdition(finalArticles);
  return finalArticles;
}
