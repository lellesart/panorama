import { FeedSource, PastelColor } from '../types/news';

export const DEFAULT_FEEDS: FeedSource[] = [
  // ==========================================
  // POLÍTICA (Imprensa Geral, Economia & Internacional)
  // ==========================================
  {
    id: 'g1-politica',
    name: 'G1 Política',
    url: 'https://g1.globo.com/rss/g1/politica/',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'g1-eleicoes',
    name: 'G1 Eleições',
    url: 'https://news.google.com/rss/search?q=site:g1.globo.com/politica/eleicoes&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://g1.globo.com/rss/g1/politica/',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'folha-poder',
    name: 'Folha • Poder',
    url: 'https://feeds.folha.uol.com.br/poder/rss091.xml',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'folha-mundo',
    name: 'Folha • Mundo',
    url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'poder360',
    name: 'Poder360',
    url: 'https://news.google.com/rss/search?q=site:poder360.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://www.poder360.com.br/feed/',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'valor-economico',
    name: 'Valor Econômico',
    url: 'https://news.google.com/rss/search?q=site:valor.globo.com&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'bbc-brasil',
    name: 'BBC News Brasil',
    url: 'https://feeds.bbci.co.uk/portuguese/rss.xml',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:bbc.com/portuguese&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },
  {
    id: 'el-pais',
    name: 'El País',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/america/portada',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:elpais.com+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Política',
    color: 'sky',
    enabled: true,
  },

  // ==========================================
  // ESQUERDA POLÍTICA
  // ==========================================
  {
    id: 'the-intercept-brasil',
    name: 'The Intercept Brasil',
    url: 'https://www.intercept.com.br/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:intercept.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esquerda Política',
    color: 'coral',
    enabled: true,
  },
  {
    id: 'brasil-247',
    name: 'Brasil 247',
    url: 'https://news.google.com/rss/search?q=site:brasil247.com&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://www.brasil247.com/feed.rss',
    category: 'Esquerda Política',
    color: 'coral',
    enabled: true,
  },
  {
    id: 'opera-mundi',
    name: 'Opera Mundi',
    url: 'https://news.google.com/rss/search?q=site:operamundi.uol.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://operamundi.uol.com.br/feed/',
    category: 'Esquerda Política',
    color: 'coral',
    enabled: true,
  },
  {
    id: 'outras-palavras',
    name: 'Outras Palavras',
    url: 'https://outraspalavras.net/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:outraspalavras.net&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esquerda Política',
    color: 'coral',
    enabled: true,
  },
  {
    id: 'le-monde-diplomatique',
    name: 'Le Monde Diplomatique Brasil',
    url: 'https://diplomatique.org.br/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:diplomatique.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esquerda Política',
    color: 'coral',
    enabled: true,
  },

  // ==========================================
  // DIREITA POLÍTICA
  // ==========================================
  {
    id: 'brasil-paralelo',
    name: 'Brasil Paralelo',
    url: 'https://news.google.com/rss/search?q=site:brasilparalelo.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Direita Política',
    color: 'lavender',
    enabled: true,
  },
  {
    id: 'jornal-cidade-online',
    name: 'Jornal da Cidade Online',
    url: 'https://news.google.com/rss/search?q=site:jornaldacidadeonline.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Direita Política',
    color: 'lavender',
    enabled: true,
  },
  {
    id: 'instituto-mises',
    name: 'Instituto Mises Brasil',
    url: 'https://news.google.com/rss/search?q=site:mises.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Direita Política',
    color: 'lavender',
    enabled: true,
  },

  // ==========================================
  // ESPORTE
  // ==========================================
  {
    id: 'g1-esporte',
    name: 'ge • G1 Esporte',
    url: 'https://news.google.com/rss/search?q=site:ge.globo.com&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esporte',
    color: 'rose',
    enabled: true,
  },
  {
    id: 'espn-brasil',
    name: 'ESPN Brasil',
    url: 'https://news.google.com/rss/search?q=site:espn.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esporte',
    color: 'rose',
    enabled: true,
  },
  {
    id: 'lance',
    name: 'Lance!',
    url: 'https://news.google.com/rss/search?q=site:lance.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Esporte',
    color: 'rose',
    enabled: true,
  },
  {
    id: 'folha-esporte',
    name: 'Folha • Esporte',
    url: 'https://feeds.folha.uol.com.br/esporte/rss091.xml',
    category: 'Esporte',
    color: 'rose',
    enabled: true,
  },

  // ==========================================
  // CIDADES & COTIDIANO
  // ==========================================
  {
    id: 'metropoles',
    name: 'Metrópoles',
    url: 'https://news.google.com/rss/search?q=site:metropoles.com&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://www.metropoles.com/feed',
    category: 'Cidades',
    color: 'butter',
    enabled: true,
  },
  {
    id: 'uol-noticias',
    name: 'UOL Cotidiano',
    url: 'https://news.google.com/rss/search?q=site:noticias.uol.com.br/cotidiano&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://rss.uol.com.br/feed/cotidiano.xml',
    category: 'Cidades',
    color: 'butter',
    enabled: true,
  },
  {
    id: 'folha-cidades',
    name: 'Folha • Cotidiano',
    url: 'https://feeds.folha.uol.com.br/cotidiano/rss091.xml',
    category: 'Cidades',
    color: 'butter',
    enabled: true,
  },

  // ==========================================
  // ESTADO (Rio de Janeiro)
  // ==========================================
  {
    id: 'g1-rj',
    name: 'G1 Rio de Janeiro',
    url: 'https://g1.globo.com/rss/g1/rio-de-janeiro/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:g1.globo.com/rj/rio-de-janeiro&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Estado',
    color: 'mint',
    enabled: true,
  },
  {
    id: 'diario-do-rio-estado',
    name: 'Diário do Rio',
    url: 'https://diariodorio.com/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:diariodorio.com&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Estado',
    color: 'mint',
    enabled: true,
  },

  // ==========================================
  // CLIMA & MEIO AMBIENTE
  // ==========================================
  {
    id: 'g1-clima',
    name: 'G1 Meio Ambiente',
    url: 'https://g1.globo.com/rss/g1/natureza/',
    category: 'Clima',
    color: 'sage',
    enabled: true,
  },

  // ==========================================
  // CULTURA
  // ==========================================
  {
    id: 'folha-ilustrada',
    name: 'Folha • Ilustrada',
    url: 'https://feeds.folha.uol.com.br/ilustrada/rss091.xml',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'omelete',
    name: 'Omelete',
    url: 'https://news.google.com/rss/search?q=site:omelete.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'agencia-brasil-cultura',
    name: 'Agência Brasil • Cultura',
    url: 'https://news.google.com/rss/search?q=site:agenciabrasil.ebc.com.br+cultura&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'diario-do-rio-cultura',
    name: 'Diário do Rio • Cultura',
    url: 'https://diariodorio.com/category/cultura/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:diariodorio.com+cultura&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'cinematorio',
    name: 'Cinematório',
    url: 'https://www.cinematorio.com.br/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:cinematorio.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'filme-b',
    name: 'Filme B',
    url: 'https://news.google.com/rss/search?q=site:filmeb.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    fallbackUrl: 'https://www.filmeb.com.br/rss.xml',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'rotten-tomatoes',
    name: 'Rotten Tomatoes',
    url: 'https://editorial.rottentomatoes.com/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:editorial.rottentomatoes.com&hl=en-US&gl=US&ceid=US:en',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'nexo-jornal',
    name: 'Nexo Jornal',
    url: 'https://www.nexojornal.com.br/rss.xml',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },
  {
    id: 'g1-cultura',
    name: 'G1 Pop & Arte',
    url: 'https://g1.globo.com/rss/g1/pop-arte/',
    category: 'Cultura',
    color: 'peach',
    enabled: true,
  },

  // ==========================================
  // TECNOLOGIA
  // ==========================================
  {
    id: 'the-verge',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:theverge.com&hl=en-US&gl=US&ceid=US:en',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:techcrunch.com&hl=en-US&gl=US&ceid=US:en',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
  {
    id: 'reuters-tech',
    name: 'Reuters • Technology',
    url: 'https://news.google.com/rss/search?q=site:reuters.com/technology&hl=en-US&gl=US&ceid=US:en',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
  {
    id: '404-media',
    name: '404 Media',
    url: 'https://www.404media.co/rss/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:404media.co&hl=en-US&gl=US&ceid=US:en',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
  {
    id: 'gizmodo',
    name: 'Gizmodo',
    url: 'https://gizmodo.com/feed',
    fallbackUrl: 'https://gizmodo.uol.com.br/feed/',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
  {
    id: 'outer-space',
    name: 'Outer Space',
    url: 'https://www.outerspace.com.br/feed/',
    fallbackUrl:
      'https://news.google.com/rss/search?q=site:outerspace.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    category: 'Tecnologia',
    color: 'slate',
    enabled: true,
  },
];

export const PASTEL_COLOR_MAP: Record<
  PastelColor,
  { bg: string; label: string; hex: string }
> = {
  sky: {
    bg: 'bg-[#D0E1EB]',
    label: 'Sky (Política & Economia)',
    hex: '#D0E1EB',
  },
  coral: {
    bg: 'bg-[#F4C7C3]',
    label: 'Coral (Esquerda Política)',
    hex: '#F4C7C3',
  },
  lavender: {
    bg: 'bg-[#D5D8F0]',
    label: 'Lavender (Direita Política)',
    hex: '#D5D8F0',
  },
  rose: {
    bg: 'bg-[#F2D6DC]',
    label: 'Rose (Esporte)',
    hex: '#F2D6DC',
  },
  butter: {
    bg: 'bg-[#F3E9C6]',
    label: 'Butter (Cidades & Cotidiano)',
    hex: '#F3E9C6',
  },
  mint: {
    bg: 'bg-[#CBE8E0]',
    label: 'Mint (Estado • RJ)',
    hex: '#CBE8E0',
  },
  sage: {
    bg: 'bg-[#D4E2D4]',
    label: 'Sage (Clima & Ambiente)',
    hex: '#D4E2D4',
  },
  peach: {
    bg: 'bg-[#F5D5CB]',
    label: 'Peach (Cultura)',
    hex: '#F5D5CB',
  },
  slate: {
    bg: 'bg-[#D8E2EC]',
    label: 'Slate (Tecnologia)',
    hex: '#D8E2EC',
  },
};
