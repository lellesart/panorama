import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_FEEDS } from '../data/defaultFeeds';
import { Article, FeedSource, PastelColor, ViewMode } from '../types/news';

interface AddFeedPayload {
  name: string;
  url: string;
  category: string;
  color: PastelColor;
}

interface NewsState {
  feeds: FeedSource[];
  mutedKeywords: string[];
  highlightKeywords: string[];
  viewMode: ViewMode;
  savedArticles: Article[];
  readArticleIds: string[];

  // Actions - Feeds
  toggleFeed: (id: string) => void;
  addFeed: (payload: AddFeedPayload) => void;
  removeFeed: (id: string) => void;
  resetDefaultFeeds: () => void;

  // Actions - Keywords
  addMutedKeyword: (keyword: string) => void;
  removeMutedKeyword: (keyword: string) => void;
  addHighlightKeyword: (keyword: string) => void;
  removeHighlightKeyword: (keyword: string) => void;

  // Actions - View Mode
  setViewMode: (mode: ViewMode) => void;

  // Actions - Saved & Read History
  toggleSaveArticle: (article: Article) => void;
  isArticleSaved: (articleId: string) => boolean;
  markAsRead: (articleId: string) => void;
  toggleReadStatus: (articleId: string) => void;
  clearReadHistory: () => void;
}

export const useNewsStore = create<NewsState>()(
  persist(
    (set, get) => ({
      feeds: DEFAULT_FEEDS,
      mutedKeywords: ['BBB', 'fofoca', 'spoiler'],
      highlightKeywords: [],
      viewMode: 'cards',
      savedArticles: [],
      readArticleIds: [],

      toggleFeed: (id) =>
        set((state) => ({
          feeds: state.feeds.map((feed) =>
            feed.id === id ? { ...feed, enabled: !feed.enabled } : feed
          ),
        })),

      addFeed: ({ name, url, category, color }) =>
        set((state) => {
          const cleanName = name.trim();
          const cleanUrl = url.trim();
          const cleanCategory = category.trim() || 'Geral';
          const id = `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

          const newFeed: FeedSource = {
            id,
            name: cleanName,
            url: cleanUrl,
            category: cleanCategory,
            color,
            enabled: true,
          };

          return {
            feeds: [...state.feeds, newFeed],
          };
        }),

      removeFeed: (id) =>
        set((state) => ({
          feeds: state.feeds.filter((feed) => feed.id !== id),
        })),

      resetDefaultFeeds: () =>
        set({
          feeds: DEFAULT_FEEDS,
        }),

      addMutedKeyword: (keyword) =>
        set((state) => {
          const formatted = keyword.trim();
          if (!formatted) return state;
          const exists = state.mutedKeywords.some(
            (k) => k.toLowerCase() === formatted.toLowerCase()
          );
          if (exists) return state;
          return {
            mutedKeywords: [...state.mutedKeywords, formatted],
          };
        }),

      removeMutedKeyword: (keyword) =>
        set((state) => ({
          mutedKeywords: state.mutedKeywords.filter(
            (k) => k.toLowerCase() !== keyword.toLowerCase()
          ),
        })),

      addHighlightKeyword: (keyword) =>
        set((state) => {
          const formatted = keyword.trim();
          if (!formatted) return state;
          const exists = state.highlightKeywords.some(
            (k) => k.toLowerCase() === formatted.toLowerCase()
          );
          if (exists) return state;
          return {
            highlightKeywords: [...state.highlightKeywords, formatted],
          };
        }),

      removeHighlightKeyword: (keyword) =>
        set((state) => ({
          highlightKeywords: state.highlightKeywords.filter(
            (k) => k.toLowerCase() !== keyword.toLowerCase()
          ),
        })),

      setViewMode: (mode) => set({ viewMode: mode }),

      toggleSaveArticle: (article) =>
        set((state) => {
          const exists = state.savedArticles.some((item) => item.id === article.id);
          if (exists) {
            return {
              savedArticles: state.savedArticles.filter((item) => item.id !== article.id),
            };
          }
          return {
            savedArticles: [article, ...state.savedArticles],
          };
        }),

      isArticleSaved: (articleId) => {
        return get().savedArticles.some((item) => item.id === articleId);
      },

      markAsRead: (articleId) =>
        set((state) => {
          if (state.readArticleIds.includes(articleId)) return state;
          return {
            readArticleIds: [...state.readArticleIds, articleId],
          };
        }),

      toggleReadStatus: (articleId) =>
        set((state) => {
          const isRead = state.readArticleIds.includes(articleId);
          return {
            readArticleIds: isRead
              ? state.readArticleIds.filter((id) => id !== articleId)
              : [...state.readArticleIds, articleId],
          };
        }),

      clearReadHistory: () => set({ readArticleIds: [] }),
    }),
    {
      name: 'panorama-storage-v10',
    }
  )
);
