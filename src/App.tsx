import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  FolderOpen,
  Highlighter,
  LayoutGrid,
  List,
  Newspaper,
  Plus,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  VolumeX,
  X,
} from 'lucide-react';
import { PASTEL_COLOR_MAP } from './data/defaultFeeds';
import {
  fetchAllActiveFeeds,
  fetchFullArticleContent,
  formatReadableHtml,
  getInitialCachedEdition,
  FeedLoadStatus,
} from './services/rssService';
import { useNewsStore } from './store/useNewsStore';
import { Article, PastelColor, ViewMode } from './types/news';

/**
 * Formata data de publicação em formato legível de jornal/relógio
 */
function formatRelativeOrShortDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Agora mesmo';
    if (diffMinutes < 60) return `Há ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Há ${diffHours}h`;

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Escapa caracteres especiais de Regex para o grifo automático
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renderiza o título aplicando o efeito Marca-Texto Pastel nas palavras cadastradas
 */
const HighlightedTitle: React.FC<{ title: string; keywords: string[] }> = ({
  title,
  keywords,
}) => {
  const validKeywords = keywords.map((k) => k.trim()).filter(Boolean);

  if (validKeywords.length === 0) {
    return <>{title}</>;
  }

  const pattern = new RegExp(`(${validKeywords.map(escapeRegExp).join('|')})`, 'gi');
  const parts = title.split(pattern);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = validKeywords.some(
          (kw) => kw.toLowerCase() === part.toLowerCase()
        );
        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-[#F3E9C6] text-[#141413] border-b border-[#141413] px-1 rounded-sm font-semibold"
            >
              {part}
            </mark>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
};

export function App() {
  const {
    feeds,
    customFeedIds,
    mutedKeywords,
    highlightKeywords,
    viewMode,
    navFilter,
    activeArticle,
    savedArticles,
    readArticleIds,
    toggleFeed,
    addFeed,
    removeFeed,
    resetDefaultFeeds,
    setCustomFeedIds,
    addMutedKeyword,
    removeMutedKeyword,
    addHighlightKeyword,
    removeHighlightKeyword,
    setViewMode,
    setNavFilter,
    setActiveArticle,
    toggleSaveArticle,
    markAsRead,
    toggleReadStatus,
    clearReadHistory,
  } = useNewsStore();

  // Estado de navegação e UI local
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isPortalsOpen, setIsPortalsOpen] = useState(false);
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);
  const [draftCustomIds, setDraftCustomIds] = useState<string[]>(customFeedIds);
  const [customSaveFeedback, setCustomSaveFeedback] = useState(false);

  // Sincroniza rascunho de portais do "Seu Feed" e abre seletor se ainda estiver vazio
  useEffect(() => {
    setDraftCustomIds(customFeedIds);
    if (navFilter.type === 'custom' && customFeedIds.length === 0) {
      setIsCustomPickerOpen(true);
    }
  }, [navFilter, customFeedIds]);

  const handleToggleDraftFeed = (feedId: string) => {
    setDraftCustomIds((prev) =>
      prev.includes(feedId)
        ? prev.filter((id) => id !== feedId)
        : [...prev, feedId]
    );
  };

  const handleSaveCustomFeed = () => {
    setCustomFeedIds(draftCustomIds);
    setCustomSaveFeedback(true);
    if (draftCustomIds.length > 0) {
      setIsCustomPickerOpen(false);
    }
    setTimeout(() => setCustomSaveFeedback(false), 2500);
  };
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<
    (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null
  >(null);

  // Captura o evento de instalação do PWA (Chrome, Edge, Android, Desktop)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(
        e as Event & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        }
      );
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  };

  // Reseta a paginação ao trocar de caderno/portal ou buscar
  useEffect(() => {
    setVisibleCount(24);
  }, [navFilter, searchQuery]);

  // Estado do formulário do Modal de Personalização
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('Política');
  const [newFeedColor, setNewFeedColor] = useState<PastelColor>('sky');
  const [newMuteInput, setNewMuteInput] = useState('');
  const [newHighlightInput, setNewHighlightInput] = useState('');

  // Artigos parciais recebidos via streaming progressivo ou cache local instantâneo
  const [streamingArticles, setStreamingArticles] = useState<Article[]>(() =>
    getInitialCachedEdition()
  );
  const [feedStatus, setFeedStatus] = useState<FeedLoadStatus>({
    completed: 0, total: 0, failedSources: [],
  });

  // Busca de feeds RSS reais com React Query + Streaming Progressivo
  const {
    data: queryArticles,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'rss-feeds',
      feeds
        .filter((f) => f.enabled)
        .map((f) => `${f.id}:${f.url}:${f.fallbackUrl || ''}`)
        .join('|'),
    ],
    queryFn: ({ signal }) =>
      fetchAllActiveFeeds(feeds, (partial) => {
        if (!signal.aborted) setStreamingArticles(partial);
      }, (status) => {
        if (!signal.aborted) setFeedStatus(status);
      }),
    staleTime: 1000 * 60 * 10, // 10 minutos de cache
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

  // Usa os artigos finais da query ou os artigos parciais em streaming / cache local
  const fetchedArticles = useMemo(() => {
    if (!isFetching && queryArticles !== undefined) {
      return queryArticles;
    }
    const enabledIds = new Set(feeds.filter((f) => f.enabled).map((f) => f.id));
    return streamingArticles.filter((art) => enabledIds.has(art.sourceId));
  }, [queryArticles, streamingArticles, feeds, isFetching]);

  // Lista de categorias únicas presentes nos feeds
  const categories = useMemo(() => {
    const map = new Map<string, PastelColor>();
    feeds.forEach((f) => {
      if (!map.has(f.category)) {
        map.set(f.category, f.color);
      }
    });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  }, [feeds]);

  // Quantidade de artigos silenciados pelas Mute Keywords
  const mutedCount = useMemo(() => {
    if (mutedKeywords.length === 0) return 0;
    return fetchedArticles.filter((article) => {
      const haystack = `${article.title} ${article.contentSnippet}`.toLowerCase();
      return mutedKeywords.some((kw) => haystack.includes(kw.toLowerCase()));
    }).length;
  }, [fetchedArticles, mutedKeywords]);

  // Filtragem principal (Navegação + Mute Keywords + Busca)
  const filteredArticles = useMemo(() => {
    const sourceList =
      navFilter.type === 'saved' ? savedArticles : fetchedArticles;

    return sourceList.filter((article) => {
      // 1. Filtro de Mute Keywords (não oculta nos Recortes Salvos para o usuário não perder o que salvou)
      if (navFilter.type !== 'saved' && mutedKeywords.length > 0) {
        const textToCheck = `${article.title} ${article.contentSnippet}`.toLowerCase();
        const isMuted = mutedKeywords.some((kw) =>
          textToCheck.includes(kw.toLowerCase())
        );
        if (isMuted) return false;
      }

      // 2. Filtro de "Seu Feed", Categoria ou Fonte da Sidebar
      if (navFilter.type === 'custom') {
        if (!customFeedIds.includes(article.sourceId)) {
          return false;
        }
      }
      if (navFilter.type === 'category' && article.category !== navFilter.category) {
        return false;
      }
      if (navFilter.type === 'source' && article.sourceId !== navFilter.sourceId) {
        return false;
      }

      // 3. Filtro de Busca no Header
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(q);
        const matchSnippet = article.contentSnippet.toLowerCase().includes(q);
        const matchSource = article.sourceName.toLowerCase().includes(q);
        if (!matchTitle && !matchSnippet && !matchSource) return false;
      }

      return true;
    });
  }, [
    fetchedArticles,
    savedArticles,
    navFilter,
    customFeedIds,
    mutedKeywords,
    searchQuery,
  ]);

  // Quantidade de artigos disponíveis no "Seu Feed"
  const customFeedArticlesCount = useMemo(() => {
    if (customFeedIds.length === 0) return 0;
    const setIds = new Set(customFeedIds);
    return fetchedArticles.filter((a) => setIds.has(a.sourceId)).length;
  }, [fetchedArticles, customFeedIds]);

  // Artigos visíveis na página atual (paginação progressiva para performance de DOM)
  const displayedArticles = useMemo(
    () => filteredArticles.slice(0, visibleCount),
    [filteredArticles, visibleCount]
  );

  // Abrir notícia no Reader Drawer, marcar como lida e buscar o texto completo da matéria sob demanda
  const [isLoadingArticleBody, setIsLoadingArticleBody] = useState(false);

  const enrichArticleContent = async (article: Article) => {
    const plainText = (article.contentHtml || '')
      .replace(/<[^>]+>/g, '')
      .trim();
    const isPlaceholderSnippet = plainText.startsWith('Cobertura atualizada em ');

    if (plainText.length < 700 || isPlaceholderSnippet || !article.thumbnail) {
      setIsLoadingArticleBody(true);
      const extracted = await fetchFullArticleContent(article);
      setIsLoadingArticleBody(false);

      if (extracted) {
        setActiveArticle((current) => {
          if (!current || current.id !== article.id) return current;
          const newHtmlLength = (extracted.contentHtml || '')
            .replace(/<[^>]+>/g, '')
            .trim().length;
          return {
            ...current,
            link: extracted.url || current.link,
            contentHtml:
              (newHtmlLength > plainText.length || isPlaceholderSnippet) &&
              extracted.contentHtml
                ? extracted.contentHtml
                : current.contentHtml,
            thumbnail: current.thumbnail || extracted.thumbnail,
            author: current.author || extracted.author,
          };
        });
      }
    }
  };

  const handleOpenArticle = async (article: Article) => {
    markAsRead(article.id);
    setActiveArticle(article);
    await enrichArticleContent(article);
  };

  // Caso um artigo já estivesse aberto ao recarregar a página, busca o texto completo se ainda estiver resumido
  useEffect(() => {
    if (activeArticle) {
      enrichArticleContent(activeArticle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArticle?.id]);

  // Adicionar novo feed RSS pelo modal
  const handleAddFeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedName.trim() || !newFeedUrl.trim()) return;
    addFeed({
      name: newFeedName,
      url: newFeedUrl,
      category: newFeedCategory,
      color: newFeedColor,
    });
    setNewFeedName('');
    setNewFeedUrl('');
  };

  // Adicionar palavra silenciada
  const handleAddMute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMuteInput.trim()) return;
    addMutedKeyword(newMuteInput);
    setNewMuteInput('');
  };

  // Adicionar palavra de marca-texto
  const handleAddHighlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHighlightInput.trim()) return;
    addHighlightKeyword(newHighlightInput);
    setNewHighlightInput('');
  };

  // Título da seção atual
  const currentViewTitle = useMemo(() => {
    if (navFilter.type === 'all') return 'Edição do Dia — Todas as Fontes';
    if (navFilter.type === 'custom') return 'Seu Feed — Seleção Pessoal';
    if (navFilter.type === 'saved') return 'Pasta de Recortes Salvos';
    if (navFilter.type === 'category') return `Caderno: ${navFilter.category}`;
    if (navFilter.type === 'source') {
      const found = feeds.find((f) => f.id === navFilter.sourceId);
      return found ? `Portal: ${found.name}` : 'Portal';
    }
    return 'Edição do Dia';
  }, [navFilter, feeds]);

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#141413] flex flex-col md:flex-row font-sans">
      {/* OVERLAY MOBILE SIDEBAR */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-[#141413]/40 z-30 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR — CADERNOS, RECORTES E PORTAIS */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-72 bg-[#EFECE6] border-r-[1.5px] border-[#141413] flex flex-col justify-between transition-transform duration-200 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Topo / Masthead da Sidebar */}
        <div className="p-5 border-b-[1.5px] border-[#141413]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="font-serif text-3xl font-bold tracking-tight leading-none text-[#141413]">
                Panorama
              </h1>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5C5A55] mt-1 pl-0.5">
                Central Editorial
              </span>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1 border-[1.5px] border-[#141413] rounded-sm bg-[#F7F4EF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navegação Rolável */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Seção Principal */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-[#5C5A55] mb-2 px-1">
              Mesa de Leitura
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setNavFilter({ type: 'all' });
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm border-[1.5px] transition-all ${
                  navFilter.type === 'all'
                    ? 'bg-[#E5DEC9] border-[#141413] shadow-[2px_2px_0px_#141413] font-semibold'
                    : 'border-transparent hover:bg-[#E5DEC9]/60 hover:border-[#141413]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Todas as Notícias
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 bg-[#F7F4EF] border border-[#141413] rounded-sm">
                  {fetchedArticles.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setNavFilter({ type: 'custom' });
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm border-[1.5px] transition-all ${
                  navFilter.type === 'custom'
                    ? 'bg-[#D4E2D4] border-[#141413] shadow-[2px_2px_0px_#141413] font-semibold'
                    : 'border-transparent hover:bg-[#E5DEC9]/60 hover:border-[#141413]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Seu Feed
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 bg-[#F7F4EF] border border-[#141413] rounded-sm">
                  {customFeedArticlesCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setNavFilter({ type: 'saved' });
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-sm border-[1.5px] transition-all ${
                  navFilter.type === 'saved'
                    ? 'bg-[#F3E9C6] border-[#141413] shadow-[2px_2px_0px_#141413] font-semibold'
                    : 'border-transparent hover:bg-[#E5DEC9]/60 hover:border-[#141413]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  Recortes Salvos
                </span>
                <span className="font-mono text-xs px-1.5 py-0.5 bg-[#F7F4EF] border border-[#141413] rounded-sm">
                  {savedArticles.length}
                </span>
              </button>
            </div>
          </div>

          {/* Cadernos / Categorias (Inicia aberto, recolhível) */}
          <div>
            <button
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
              className="w-full flex items-center justify-between mb-2 px-1 py-0.5 text-left group"
              title={isCategoriesOpen ? 'Recolher cadernos' : 'Expandir cadernos'}
            >
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#5C5A55] group-hover:text-[#141413] flex items-center gap-1">
                {isCategoriesOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Cadernos Temáticos
              </span>
              <span className="font-mono text-[10px] text-[#5C5A55]">
                ({categories.length})
              </span>
            </button>

            {isCategoriesOpen && (
              <div className="space-y-1.5">
                {categories.map((cat) => {
                  const isSelected =
                    navFilter.type === 'category' && navFilter.category === cat.name;
                  const badgeClass = PASTEL_COLOR_MAP[cat.color]?.bg || 'bg-[#D0E1EB]';

                  return (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setNavFilter({ type: 'category', category: cat.name });
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-sm border-[1.5px] transition-all ${
                        isSelected
                          ? 'bg-[#E5DEC9] border-[#141413] shadow-[2px_2px_0px_#141413] font-semibold'
                          : 'border-transparent hover:bg-[#E5DEC9]/60 hover:border-[#141413]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className={`w-3 h-3 rounded-sm border border-[#141413] shrink-0 ${badgeClass}`}
                        />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <FolderOpen className="w-3.5 h-3.5 text-[#5C5A55] shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Portais Assinados (Inicia recolhido, recolhível) */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                onClick={() => setIsPortalsOpen((prev) => !prev)}
                className="font-mono text-[11px] uppercase tracking-wider text-[#5C5A55] hover:text-[#141413] flex items-center gap-1 text-left"
                title={isPortalsOpen ? 'Recolher portais' : 'Expandir portais'}
              >
                {isPortalsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>
                  Portais ({feeds.filter((f) => f.enabled).length}/{feeds.length})
                </span>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="font-mono text-[11px] underline hover:text-[#141413] text-[#5C5A55] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Novo RSS
              </button>
            </div>

            {isPortalsOpen && (
              <div className="space-y-1.5">
                {feeds.map((feed) => {
                  const isSourceSelected =
                    navFilter.type === 'source' && navFilter.sourceId === feed.id;
                  const pastelBg = PASTEL_COLOR_MAP[feed.color]?.bg || 'bg-[#D0E1EB]';

                  return (
                    <div
                      key={feed.id}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-sm border-[1.5px] transition-all ${
                        isSourceSelected
                          ? 'bg-[#E5DEC9] border-[#141413] shadow-[2px_2px_0px_#141413]'
                          : 'bg-[#F7F4EF]/70 border-[#141413]/40 hover:border-[#141413]'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setNavFilter({ type: 'source', sourceId: feed.id });
                          setIsMobileSidebarOpen(false);
                        }}
                        className={`flex items-center gap-2 text-left text-xs font-medium truncate flex-1 ${
                          !feed.enabled ? 'line-through text-[#5C5A55]' : ''
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-sm border border-[#141413] shrink-0 ${pastelBg}`}
                        />
                        <span className="truncate">{feed.name}</span>
                      </button>

                      <button
                        onClick={() => toggleFeed(feed.id)}
                        title={feed.enabled ? 'Desativar portal' : 'Ativar portal'}
                        className={`ml-2 px-1.5 py-0.5 font-mono text-[10px] uppercase border border-[#141413] rounded-sm transition-colors ${
                          feed.enabled
                            ? 'bg-[#D4E2D4] text-[#141413] font-semibold'
                            : 'bg-[#EFECE6] text-[#5C5A55]'
                        }`}
                      >
                        {feed.enabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo de Filtros Ativos */}
          <div className="p-3 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Motor Editorial
              </span>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="font-mono text-[10px] underline text-[#5C5A55] hover:text-[#141413]"
              >
                Editar
              </button>
            </div>
            <div className="text-xs text-[#5C5A55] space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Grifos ativos:</span>
                <span className="text-[#141413] font-semibold">
                  {highlightKeywords.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Silenciadas:</span>
                <span className="text-[#141413] font-semibold">
                  {mutedKeywords.length} ({mutedCount} ocultas)
                </span>
              </div>
              <div className="flex justify-between">
                <span>Artigos lidos:</span>
                <span className="text-[#141413] font-semibold">
                  {readArticleIds.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t-[1.5px] border-[#141413] bg-[#EFECE6] space-y-2">
          {deferredInstallPrompt && (
            <button
              onClick={handleInstallPwa}
              className="w-full py-2 px-3 bg-[#D4E2D4] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] transition-all flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider"
            >
              <Download className="w-4 h-4" />
              Instalar App Panorama
            </button>
          )}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full py-2.5 px-3 bg-[#F3E9C6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] hover:shadow-[4px_4px_0px_#141413] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Personalizar Feed
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER EDITORIAL */}
        <header className="sticky top-0 z-20 bg-[#F7F4EF]/95 backdrop-blur-sm border-b-[1.5px] border-[#141413] px-4 md:px-8 py-4">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            {/* Linha Superior: Data, Status e Botões Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#141413]/20 pb-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden px-2.5 py-1 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold"
                >
                  Menu
                </button>
                <span className="font-mono text-xs uppercase tracking-wider text-[#5C5A55]">
                  {todayFormatted}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {readArticleIds.length > 0 && (
                  <button
                    onClick={clearReadHistory}
                    className="font-mono text-xs text-[#5C5A55] hover:text-[#141413] underline"
                    title="Marcar todos os artigos como não lidos"
                  >
                    Resetar lidos ({readArticleIds.length})
                  </button>
                )}

                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="px-3 py-1 bg-[#EFECE6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] flex items-center gap-1.5 font-mono text-xs font-medium transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  {isFetching ? 'Imprimindo...' : 'Atualizar'}
                </button>
              </div>
            </div>

            {/* Linha Principal: Título do Caderno, Busca e Troca de Layout */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-[#141413]">
                  {currentViewTitle}
                </h2>
                <p className="text-xs font-mono text-[#5C5A55] mt-0.5">
                  Exibindo {displayedArticles.length} de {filteredArticles.length}{' '}
                  artigos • Grifos ativos:{' '}
                  {highlightKeywords.length > 0
                    ? highlightKeywords.join(', ')
                    : 'Nenhum'}
                </p>
                <p role="status" className="mt-2 text-sm text-[#5C5A55]">
                  {isFetching
                    ? `Consultando fontes: ${feedStatus.completed} de ${feedStatus.total}.`
                    : `${feedStatus.total - feedStatus.failedSources.length} de ${feedStatus.total} fontes responderam.`}
                </p>
                {feedStatus.failedSources.length > 0 && (
                  <details className="mt-2 max-w-xl text-sm text-[#5C5A55]">
                    <summary className="cursor-pointer underline underline-offset-4">
                      Fontes sem notícias nesta consulta ({feedStatus.failedSources.length})
                    </summary>
                    <p className="mt-2 break-words">
                      {feedStatus.failedSources.join(', ')}. Tente Atualizar novamente;
                      o feed pode estar indisponível ou bloqueando a consulta.
                    </p>
                  </details>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Barra de Busca */}
                <div className="relative flex-1 sm:w-72 md:w-80">
                  <Search className="w-4 h-4 text-[#5C5A55] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar manchetes ou fontes..."
                    className={`w-full pl-9 ${
                      searchQuery ? 'pr-8' : 'pr-3'
                    } py-2 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm text-sm placeholder:text-[#5C5A55] focus:outline-none focus:bg-[#F7F4EF] shadow-[2px_2px_0px_#141413]`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5C5A55] hover:text-[#141413]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Seletor dos 3 Modos de Visualização */}
                <div className="flex items-center bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-0.5 shadow-[2px_2px_0px_#141413]">
                  {(
                    [
                      {
                        id: 'magazine',
                        label: 'Revista',
                        icon: Newspaper,
                      },
                      {
                        id: 'cards',
                        label: 'Cartões',
                        icon: LayoutGrid,
                      },
                      {
                        id: 'compact',
                        label: 'Compacto',
                        icon: List,
                      },
                    ] as { id: ViewMode; label: string; icon: React.ElementType }[]
                  ).map((mode) => {
                    const Icon = mode.icon;
                    const active = viewMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id)}
                        className={`px-2.5 py-1.5 rounded-sm font-mono text-xs flex items-center gap-1.5 transition-all ${
                          active
                            ? 'bg-[#F3E9C6] text-[#141413] font-semibold border border-[#141413]'
                            : 'text-[#5C5A55] hover:text-[#141413]'
                        }`}
                        title={`Modo ${mode.label}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ÁREA DO FEED DE NOTÍCIAS */}
        <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl w-full mx-auto">
          {/* Painel de Configuração do "Seu Feed" */}
          {navFilter.type === 'custom' && (
            <section className="mb-6 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-5 shadow-[3px_3px_0px_#141413]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#141413] flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Portais do Seu Feed ({customFeedIds.length} selecionados)
                  </h3>
                  <p className="text-xs font-mono text-[#5C5A55] mt-0.5">
                    Escolha quais portais deseja acompanhar nesta página e clique em
                    Salvar para gravar no seu aparelho.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {customSaveFeedback && (
                    <span className="px-2.5 py-1 bg-[#D4E2D4] border border-[#141413] rounded-sm font-mono text-xs font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Salvo no aparelho!
                    </span>
                  )}
                  <button
                    onClick={() => setIsCustomPickerOpen((prev) => !prev)}
                    className="px-3.5 py-1.5 bg-[#F7F4EF] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-1.5"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {isCustomPickerOpen ? 'Ocultar Seleção' : 'Escolher Portais'}
                  </button>
                </div>
              </div>

              {isCustomPickerOpen && (
                <div className="mt-5 pt-4 border-t-[1.5px] border-[#141413]/20 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftCustomIds(feeds.map((f) => f.id))}
                        className="px-2.5 py-1 bg-[#F7F4EF] hover:bg-[#E5DEC9] border border-[#141413] rounded-sm font-mono text-xs"
                      >
                        Marcar Todos ({feeds.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftCustomIds([])}
                        className="px-2.5 py-1 bg-[#F7F4EF] hover:bg-[#E5DEC9] border border-[#141413] rounded-sm font-mono text-xs"
                      >
                        Limpar Seleção
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCustomFeed}
                      className="px-5 py-2 bg-[#F3E9C6] hover:bg-[#D4E2D4] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] hover:shadow-[4px_4px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Salvar no Aparelho ({draftCustomIds.length})
                    </button>
                  </div>

                  {/* Grade de Portais Agrupados por Caderno */}
                  <div className="space-y-4">
                    {categories.map((cat) => {
                      const categoryFeeds = feeds.filter(
                        (f) => f.category === cat.name
                      );
                      const badgeBg =
                        PASTEL_COLOR_MAP[cat.color]?.bg || 'bg-[#D0E1EB]';

                      return (
                        <div
                          key={cat.name}
                          className="p-3.5 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm"
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span
                              className={`px-2 py-0.5 font-mono text-xs font-semibold border border-[#141413] rounded-sm ${badgeBg}`}
                            >
                              {cat.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const catIds = categoryFeeds.map((f) => f.id);
                                const allChecked = catIds.every((id) =>
                                  draftCustomIds.includes(id)
                                );
                                if (allChecked) {
                                  setDraftCustomIds((prev) =>
                                    prev.filter((id) => !catIds.includes(id))
                                  );
                                } else {
                                  setDraftCustomIds((prev) =>
                                    Array.from(new Set([...prev, ...catIds]))
                                  );
                                }
                              }}
                              className="font-mono text-[11px] underline text-[#5C5A55] hover:text-[#141413]"
                            >
                              Alternar caderno
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {categoryFeeds.map((feed) => {
                              const isChecked = draftCustomIds.includes(feed.id);
                              return (
                                <label
                                  key={feed.id}
                                  onClick={() => handleToggleDraftFeed(feed.id)}
                                  className={`cursor-pointer flex items-center justify-between px-3 py-2 rounded-sm border-[1.5px] text-xs font-medium transition-all select-none ${
                                    isChecked
                                      ? 'bg-[#D4E2D4] border-[#141413] shadow-[2px_2px_0px_#141413] font-semibold'
                                      : 'bg-[#EFECE6]/70 border-[#141413]/40 hover:border-[#141413]'
                                  }`}
                                >
                                  <span className="truncate pr-2">{feed.name}</span>
                                  <span
                                    className={`w-4 h-4 rounded-sm border border-[#141413] flex items-center justify-center shrink-0 ${
                                      isChecked ? 'bg-[#141413] text-[#F7F4EF]' : 'bg-[#F7F4EF]'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3" />}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleSaveCustomFeed}
                      className="px-6 py-2.5 bg-[#141413] text-[#F7F4EF] hover:bg-[#141413]/90 rounded-sm shadow-[3px_3px_0px_#5C5A55] font-mono text-xs font-semibold uppercase flex items-center gap-2 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Salvar Seu Feed ({draftCustomIds.length} portais)
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Estado de Carregamento Inicial (apenas se não houver artigos em streaming/cache) */}
          {isLoading && fetchedArticles.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-5 shadow-[3px_3px_0px_#141413] animate-pulse space-y-4"
                >
                  <div className="flex justify-between">
                    <div className="h-5 w-24 bg-[#E5DEC9] border border-[#141413] rounded-sm" />
                    <div className="h-4 w-16 bg-[#E5DEC9] rounded-sm" />
                  </div>
                  <div className="h-7 bg-[#E5DEC9] rounded-sm w-11/12" />
                  <div className="h-7 bg-[#E5DEC9] rounded-sm w-3/4" />
                  <div className="h-20 bg-[#E5DEC9] rounded-sm" />
                </div>
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            /* Estado Vazio */
            <div className="my-12 max-w-lg mx-auto bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-8 text-center shadow-[3px_3px_0px_#141413]">
              <div className="w-12 h-12 mx-auto mb-4 bg-[#F3E9C6] border-[1.5px] border-[#141413] rounded-sm flex items-center justify-center shadow-[2px_2px_0px_#141413]">
                <Newspaper className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-2xl font-bold mb-2">
                Nenhuma notícia encontrada nesta seção
              </h3>
              <p className="text-sm text-[#5C5A55] mb-6">
                {navFilter.type === 'saved'
                  ? 'Você ainda não guardou nenhum recorte de jornal na sua pasta.'
                  : navFilter.type === 'custom'
                  ? 'Selecione os portais desejados no painel acima e clique em "Salvar no Aparelho" para montar o Seu Feed.'
                  : 'Verifique se há portais habilitados na barra lateral ou ajuste seus filtros de busca e palavras silenciadas.'}
              </p>
              {navFilter.type !== 'all' && (
                <button
                  onClick={() => setNavFilter({ type: 'all' })}
                  className="px-4 py-2 bg-[#F3E9C6] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold uppercase"
                >
                  Voltar para Edição Completa
                </button>
              )}
            </div>
          ) : viewMode === 'compact' ? (
            /* MODO 3: COMPACT (Lista densa de linha única estilo leitor RSS clássico) */
            <div className="bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] divide-y-[1.5px] divide-[#141413]">
              {displayedArticles.map((article) => {
                const isRead = readArticleIds.includes(article.id);
                const isSaved = savedArticles.some((a) => a.id === article.id);
                const pastelBg = PASTEL_COLOR_MAP[article.color]?.bg || 'bg-[#D0E1EB]';

                return (
                  <div
                    key={article.id}
                    onClick={() => handleOpenArticle(article)}
                    className={`group flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#E5DEC9] ${
                      isRead ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono font-semibold border border-[#141413] rounded-sm shrink-0 ${pastelBg}`}
                      >
                        {article.sourceName}
                      </span>

                      <span className="font-mono text-[11px] text-[#5C5A55] hidden md:inline shrink-0">
                        [{article.category}]
                      </span>

                      <h3 className="font-serif text-base md:text-lg font-semibold text-[#141413] truncate group-hover:underline">
                        <HighlightedTitle
                          title={article.title}
                          keywords={highlightKeywords}
                        />
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-[#5C5A55] whitespace-nowrap">
                        {formatRelativeOrShortDate(article.pubDate)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSaveArticle(article);
                        }}
                        title={isSaved ? 'Remover dos Recortes' : 'Salvar Recorte'}
                        className={`p-1.5 border border-[#141413] rounded-sm transition-colors ${
                          isSaved
                            ? 'bg-[#F3E9C6] text-[#141413]'
                            : 'bg-[#F7F4EF] text-[#5C5A55] hover:text-[#141413]'
                        }`}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* MODOS 1 e 2: MAGAZINE (2 colunas com destaque editorial) & CARDS (3 colunas estilo papelaria) */
            <div
              className={
                viewMode === 'magazine'
                  ? 'grid grid-cols-1 lg:grid-cols-2 gap-6'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              }
            >
              {displayedArticles.map((article, index) => {
                const isRead = readArticleIds.includes(article.id);
                const isSaved = savedArticles.some((a) => a.id === article.id);
                const pastelBg = PASTEL_COLOR_MAP[article.color]?.bg || 'bg-[#D0E1EB]';
                const isMagazineHero = viewMode === 'magazine' && index === 0;

                return (
                  <article
                    key={article.id}
                    onClick={() => handleOpenArticle(article)}
                    className={`group cursor-pointer bg-[#EFECE6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] hover:shadow-[5px_5px_0px_#141413] hover:-translate-y-0.5 transition-all flex flex-col justify-between p-5 ${
                      isMagazineHero ? 'lg:col-span-2 lg:flex-row lg:gap-6' : ''
                    } ${isRead ? 'opacity-60' : ''}`}
                  >
                    {/* Imagem de Capa quando disponível no modo Magazine Hero ou Cards */}
                    {article.thumbnail && (
                      <div
                        className={`overflow-hidden border-[1.5px] border-[#141413] rounded-sm bg-[#F7F4EF] shrink-0 ${
                          isMagazineHero
                            ? 'mb-4 lg:mb-0 lg:w-5/12 h-56 lg:h-auto'
                            : 'mb-4 h-44 w-full'
                        }`}
                      >
                        <img
                          src={article.thumbnail}
                          alt={article.title}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display =
                              'none';
                          }}
                          className="w-full h-full object-cover grayscale-[15%] contrast-[1.03] group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      </div>
                    )}

                    <div className="flex flex-col justify-between flex-1">
                      <div>
                        {/* Metadados Superiores: Tag Pastel, Categoria e Horário */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 font-mono text-xs font-semibold border border-[#141413] rounded-sm ${pastelBg}`}
                            >
                              {article.sourceName}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-wider text-[#5C5A55]">
                              {article.category}
                            </span>
                          </div>

                          <span className="font-mono text-xs text-[#5C5A55] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeOrShortDate(article.pubDate)}
                          </span>
                        </div>

                        {/* Manchete Editorial Serifada com Marca-Texto Automático */}
                        <h3
                          className={`font-serif font-bold text-[#141413] leading-snug mb-3 ${
                            isMagazineHero ? 'text-2xl md:text-3xl' : 'text-xl'
                          }`}
                        >
                          <HighlightedTitle
                            title={article.title}
                            keywords={highlightKeywords}
                          />
                        </h3>

                        {/* Resumo Limpo */}
                        {article.contentSnippet && (
                          <p className="text-sm text-[#5C5A55] leading-relaxed line-clamp-3 mb-4">
                            {article.contentSnippet}
                          </p>
                        )}
                      </div>

                      {/* Rodapé do Cartão: Status de Leitura e Botão Recorte */}
                      <div className="pt-3 border-t border-[#141413]/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReadStatus(article.id);
                            }}
                            className="font-mono text-[11px] text-[#5C5A55] hover:text-[#141413] flex items-center gap-1"
                            title={
                              isRead ? 'Marcar como não lido' : 'Marcar como lido'
                            }
                          >
                            {isRead ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Lido
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" /> Não lido
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSaveArticle(article);
                            }}
                            className={`px-2.5 py-1 border-[1.5px] border-[#141413] rounded-sm font-mono text-xs flex items-center gap-1.5 transition-all ${
                              isSaved
                                ? 'bg-[#F3E9C6] text-[#141413] font-semibold shadow-[2px_2px_0px_#141413]'
                                : 'bg-[#F7F4EF] text-[#141413] hover:bg-[#F3E9C6]'
                            }`}
                          >
                            {isSaved ? (
                              <>
                                <BookmarkCheck className="w-3.5 h-3.5" /> Salvo
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-3.5 h-3.5" /> Recortar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Botão Editorial de Paginação Progressiva */}
          {!isLoading && filteredArticles.length > visibleCount && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 24)}
                className="px-6 py-3 bg-[#F3E9C6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] hover:shadow-[4px_4px_0px_#141413] hover:-translate-y-0.5 transition-all font-mono text-xs font-semibold uppercase tracking-wider"
              >
                Carregar mais matérias (+
                {Math.min(24, filteredArticles.length - visibleCount)} de{' '}
                {filteredArticles.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </main>
      </div>

      {/* READER DRAWER LATERAL (MODO LEITURA LIMPA EM FOLHA A4) */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#141413]/50 backdrop-blur-[1px]"
            onClick={() => setActiveArticle(null)}
          />

          {/* Folha A4 Deslizante */}
          <aside className="relative z-10 w-full max-w-2xl bg-[#F7F4EF] h-full border-l-[2px] border-[#141413] shadow-[-8px_0px_0px_#141413] flex flex-col overflow-hidden">
            {/* Barra de Topo da Folha de Leitura */}
            <div className="px-6 py-4 bg-[#EFECE6] border-b-[1.5px] border-[#141413] flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 font-mono text-xs font-semibold border border-[#141413] rounded-sm ${
                    PASTEL_COLOR_MAP[activeArticle.color]?.bg || 'bg-[#D0E1EB]'
                  }`}
                >
                  {activeArticle.sourceName}
                </span>
                <span className="font-mono text-xs text-[#5C5A55]">
                  • {activeArticle.category}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activeArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-[#F7F4EF] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm font-mono text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_#141413]"
                  title="Abrir matéria original no site do portal"
                >
                  <span className="hidden sm:inline">Abrir no Site</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={() => toggleSaveArticle(activeArticle)}
                  className={`px-3 py-1.5 border-[1.5px] border-[#141413] rounded-sm font-mono text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_#141413] ${
                    savedArticles.some((a) => a.id === activeArticle.id)
                      ? 'bg-[#F3E9C6] font-semibold'
                      : 'bg-[#F7F4EF] hover:bg-[#E5DEC9]'
                  }`}
                >
                  {savedArticles.some((a) => a.id === activeArticle.id) ? (
                    <>
                      <BookmarkCheck className="w-4 h-4" /> Recorte Salvo
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4" /> Salvar Recorte
                    </>
                  )}
                </button>

                <button
                  onClick={() => setActiveArticle(null)}
                  className="p-1.5 bg-[#F7F4EF] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413]"
                  title="Fechar leitor"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Corpo da Folha A4 */}
            <div className="flex-1 overflow-y-auto px-6 md:px-12 py-8">
              <div className="max-w-xl mx-auto">
                {/* Metadados da Matéria */}
                <div className="font-mono text-xs text-[#5C5A55] mb-3 flex flex-wrap items-center gap-2">
                  <span>{formatRelativeOrShortDate(activeArticle.pubDate)}</span>
                  {activeArticle.author && (
                    <span>• Por {activeArticle.author}</span>
                  )}
                </div>

                {/* Título Editorial */}
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#141413] leading-tight mb-6">
                  <HighlightedTitle
                    title={activeArticle.title}
                    keywords={highlightKeywords}
                  />
                </h1>

                {/* Thumbnail Principal */}
                {activeArticle.thumbnail && (
                  <figure className="mb-6 border-[1.5px] border-[#141413] rounded-sm overflow-hidden shadow-[3px_3px_0px_#141413] bg-[#EFECE6]">
                    <img
                      src={activeArticle.thumbnail}
                      alt={activeArticle.title}
                      className="w-full max-h-80 object-cover"
                    />
                  </figure>
                )}

                {/* Divisor Tipográfico */}
                <div className="border-t-[1.5px] border-b-[1.5px] border-[#141413] py-2 mb-6 flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-[#5C5A55]">
                  <span className="flex items-center gap-1.5">
                    {isLoadingArticleBody ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-[#141413]" />
                        Extraindo texto completo da reportagem...
                      </>
                    ) : (
                      'Modo Leitura Completa • Papel A4'
                    )}
                  </span>
                  <span>Panorama Reader</span>
                </div>

                {/* Conteúdo Renderizado */}
                <div
                  className="prose prose-stone max-w-none font-sans text-base leading-relaxed text-[#141413] space-y-4 [&_p]:mb-4 [&_a]:underline [&_a]:font-semibold [&_img]:border-[1.5px] [&_img]:border-[#141413] [&_img]:rounded-sm [&_img]:my-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-bold [&_blockquote]:border-l-4 [&_blockquote]:border-[#141413] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:bg-[#EFECE6] [&_blockquote]:p-3"
                  dangerouslySetInnerHTML={{
                    __html: formatReadableHtml(
                      activeArticle.contentHtml,
                      activeArticle.contentSnippet
                    ),
                  }}
                />

                {/* Box Final com Link para o Portal Original */}
                <div className="mt-10 p-5 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-serif font-bold text-lg">
                      Ler matéria completa no portal original
                    </p>
                    <p className="font-mono text-xs text-[#5C5A55]">
                      Fonte: {activeArticle.sourceName}
                    </p>
                  </div>

                  <a
                    href={activeArticle.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-[#F3E9C6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[3px_3px_0px_#141413] hover:shadow-[4px_4px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-2 shrink-0 transition-all"
                  >
                    Abrir no Portal
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* MODAL COMPLETO DE PERSONALIZAÇÃO (FONTES RSS, MUTE KEYWORDS & HIGHLIGHT KEYWORDS) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#141413]/50 backdrop-blur-[1px]"
            onClick={() => setIsSettingsOpen(false)}
          />

          {/* Janela do Modal */}
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#F7F4EF] border-[2px] border-[#141413] rounded-sm shadow-[8px_8px_0px_#141413] flex flex-col overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 bg-[#EFECE6] border-b-[1.5px] border-[#141413] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#F3E9C6] border-[1.5px] border-[#141413] rounded-sm flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold leading-none">
                    Oficina de Personalização Editorial
                  </h2>
                  <p className="font-mono text-xs text-[#5C5A55] mt-0.5">
                    Gerencie fontes RSS, filtro de silenciamento e marca-texto automático
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 bg-[#F7F4EF] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corpo do Modal Rolável */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* SEÇÃO 1: ADICIONAR NOVO FEED RSS & GERENCIAR PORTAIS */}
              <section className="bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-5 shadow-[3px_3px_0px_#141413]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Rss className="w-5 h-5 text-[#141413]" />
                    <h3 className="font-serif text-xl font-bold">
                      1. Gerenciador de Fontes RSS
                    </h3>
                  </div>

                  <button
                    onClick={resetDefaultFeeds}
                    className="px-2.5 py-1 bg-[#F7F4EF] hover:bg-[#E5DEC9] border border-[#141413] rounded-sm font-mono text-xs flex items-center gap-1"
                    title="Restaurar os 6 portais padrão"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
                  </button>
                </div>

                {/* Formulário para Adicionar Qualquer URL de RSS */}
                <form
                  onSubmit={handleAddFeedSubmit}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5 p-4 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm"
                >
                  <div className="md:col-span-3">
                    <label className="block font-mono text-[11px] uppercase mb-1">
                      Nome do Portal
                    </label>
                    <input
                      type="text"
                      required
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      placeholder="Ex: Ars Technica"
                      className="w-full px-3 py-1.5 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm text-sm focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block font-mono text-[11px] uppercase mb-1">
                      URL do Feed RSS / XML
                    </label>
                    <input
                      type="url"
                      required
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      placeholder="https://site.com/feed.xml"
                      className="w-full px-3 py-1.5 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm text-sm font-mono focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block font-mono text-[11px] uppercase mb-1">
                      Categoria
                    </label>
                    <input
                      type="text"
                      required
                      value={newFeedCategory}
                      onChange={(e) => setNewFeedCategory(e.target.value)}
                      placeholder="Tecnologia"
                      className="w-full px-3 py-1.5 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm text-sm focus:outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block font-mono text-[11px] uppercase mb-1">
                      Etiqueta Pastel
                    </label>
                    <select
                      value={newFeedColor}
                      onChange={(e) =>
                        setNewFeedColor(e.target.value as PastelColor)
                      }
                      className="w-full px-2.5 py-1.5 bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm text-sm font-mono focus:outline-none"
                    >
                      {Object.entries(PASTEL_COLOR_MAP).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-12 flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#D4E2D4] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Portal RSS
                    </button>
                  </div>
                </form>

                {/* Lista de Portais Cadastrados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {feeds.map((feed) => {
                    const pastelBg =
                      PASTEL_COLOR_MAP[feed.color]?.bg || 'bg-[#D0E1EB]';
                    return (
                      <div
                        key={feed.id}
                        className="flex items-center justify-between p-2.5 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 font-mono text-xs font-semibold border border-[#141413] rounded-sm ${pastelBg}`}
                            >
                              {feed.name}
                            </span>
                            <span className="font-mono text-[11px] text-[#5C5A55] truncate">
                              {feed.category}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-[#5C5A55] truncate mt-1">
                            {feed.url}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleFeed(feed.id)}
                            className={`px-2 py-1 border border-[#141413] rounded-sm font-mono text-[10px] uppercase font-semibold ${
                              feed.enabled ? 'bg-[#D4E2D4]' : 'bg-[#EFECE6] text-[#5C5A55]'
                            }`}
                          >
                            {feed.enabled ? 'Ativo' : 'Pausado'}
                          </button>

                          <button
                            onClick={() => removeFeed(feed.id)}
                            className="p-1.5 bg-[#F2D6DC] hover:bg-[#E5DEC9] border border-[#141413] rounded-sm text-[#141413]"
                            title="Remover fonte RSS"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SEÇÃO 2 & 3: MARCA-TEXTO AUTOMÁTICO E FILTRO DE SILENCIAMENTO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Marca-Texto Automático (Highlight Keywords) */}
                <section className="bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-5 shadow-[3px_3px_0px_#141413] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Highlighter className="w-5 h-5 text-[#141413]" />
                      <h3 className="font-serif text-xl font-bold">
                        2. Marca-Texto Automático
                      </h3>
                    </div>
                    <p className="text-xs text-[#5C5A55] mb-4">
                      Palavras de interesse que recebem grifo amarelo pastel (
                      <code className="bg-[#F3E9C6] border-b border-[#141413] px-1 font-mono text-[#141413]">
                        destaque
                      </code>
                      ) automaticamente quando aparecem nas manchetes.
                    </p>

                    <form onSubmit={handleAddHighlight} className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newHighlightInput}
                        onChange={(e) => setNewHighlightInput(e.target.value)}
                        placeholder="Ex: IA, React, Juros..."
                        className="flex-1 px-3 py-1.5 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm text-sm focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#F3E9C6] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Grifar
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                      {highlightKeywords.length === 0 ? (
                        <span className="font-mono text-xs text-[#5C5A55]">
                          Nenhuma palavra cadastrada no marca-texto.
                        </span>
                      ) : (
                        highlightKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F3E9C6] border-[1.5px] border-[#141413] rounded-sm font-mono text-xs font-semibold shadow-[2px_2px_0px_#141413]"
                          >
                            {kw}
                            <button
                              onClick={() => removeHighlightKeyword(kw)}
                              className="hover:text-[#5C5A55]"
                              title="Remover grifo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                {/* Filtro de Silenciamento (Mute Keywords) */}
                <section className="bg-[#EFECE6] border-[1.5px] border-[#141413] rounded-sm p-5 shadow-[3px_3px_0px_#141413] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <VolumeX className="w-5 h-5 text-[#141413]" />
                      <h3 className="font-serif text-xl font-bold">
                        3. Filtro de Silenciamento (Mute)
                      </h3>
                    </div>
                    <p className="text-xs text-[#5C5A55] mb-4">
                      Qualquer notícia contendo estas palavras no título ou resumo
                      será ocultada automaticamente do seu feed.
                    </p>

                    <form onSubmit={handleAddMute} className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newMuteInput}
                        onChange={(e) => setNewMuteInput(e.target.value)}
                        placeholder="Ex: BBB, fofoca, spoiler..."
                        className="flex-1 px-3 py-1.5 bg-[#F7F4EF] border-[1.5px] border-[#141413] rounded-sm text-sm focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#F2D6DC] hover:bg-[#E5DEC9] border-[1.5px] border-[#141413] rounded-sm shadow-[2px_2px_0px_#141413] font-mono text-xs font-semibold uppercase flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Silenciar
                      </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                      {mutedKeywords.length === 0 ? (
                        <span className="font-mono text-xs text-[#5C5A55]">
                          Nenhuma palavra silenciada no momento.
                        </span>
                      ) : (
                        mutedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F2D6DC] border-[1.5px] border-[#141413] rounded-sm font-mono text-xs font-semibold shadow-[2px_2px_0px_#141413]"
                          >
                            {kw}
                            <button
                              onClick={() => removeMutedKeyword(kw)}
                              className="hover:text-[#5C5A55]"
                              title="Remover palavra silenciada"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="px-6 py-4 bg-[#EFECE6] border-t-[1.5px] border-[#141413] flex items-center justify-between">
              <span className="font-mono text-xs text-[#5C5A55]">
                Preferências salvas automaticamente no navegador (Zustand Persist)
              </span>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2 bg-[#141413] text-[#F7F4EF] rounded-sm font-mono text-xs font-semibold uppercase flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
