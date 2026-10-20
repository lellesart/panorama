export type PastelColor =
  | 'sage'
  | 'peach'
  | 'lavender'
  | 'butter'
  | 'sky'
  | 'rose'
  | 'coral'
  | 'mint';

export type ViewMode = 'magazine' | 'cards' | 'compact';

export type NavigationFilter =
  | { type: 'all' }
  | { type: 'saved' }
  | { type: 'category'; category: string }
  | { type: 'source'; sourceId: string };

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  fallbackUrl?: string;
  category: string;
  color: PastelColor;
  enabled: boolean;
}

export interface Article {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
  contentHtml: string;
  thumbnail?: string;
  sourceId: string;
  sourceName: string;
  category: string;
  color: PastelColor;
  author?: string;
}

export interface Rss2JsonItem {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  thumbnail: string;
  description: string;
  content: string;
  enclosure?: {
    link?: string;
    type?: string;
  };
}

export interface Rss2JsonResponse {
  status: string;
  feed: {
    url: string;
    title: string;
    link: string;
    author: string;
    description: string;
    image: string;
  };
  items: Rss2JsonItem[];
}
