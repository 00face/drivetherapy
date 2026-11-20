import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, Image as ImageIcon, Flame } from 'lucide-react';
import { GifAPI, GifResult, Provider, defaultGifService, CURATED_OFFLINE_GIFS } from '../services/gifService';

interface GoogleChatGifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gif: GifResult) => void;
}

const CATEGORIES = [
  'Trending',
  'Cheers',
  'Applause',
  'Coding',
  'Cats',
  'Mind Blown',
  'Dancing',
  'Coffee'
];

export const GoogleChatGifPickerModal: React.FC<GoogleChatGifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif
}) => {
  const [provider, setProvider] = useState<Provider>('tenor');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>(CURATED_OFFLINE_GIFS);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      handleSearch(query || 'Trending');
    }
  }, [isOpen, provider]);

  const handleSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      defaultGifService.setProvider(provider);
      const q = searchTerm === 'Trending' ? '' : searchTerm;
      const res = await defaultGifService.search(q, 16);
      setGifs(res);
    } catch {
      setGifs(CURATED_OFFLINE_GIFS);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[var(--theme-surface,#181b22)] border border-[var(--theme-border,#2e3440)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[var(--theme-text,#eceff4)] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border,#2e3440)]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="font-semibold text-sm">Send a GIF</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]">
              Powered by {provider === 'tenor' ? 'Google Tenor' : provider.toUpperCase()}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & Provider Bar */}
        <div className="p-3 border-b border-[var(--theme-border,#2e3440)] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary,#94a3b8)]" />
            <input 
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Search GIFs across Tenor, GIPHY, KLIPY..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--theme-surface-deep,#0d1117)] border border-[var(--theme-border,#2e3440)] text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            {query && (
              <button 
                onClick={() => { setQuery(''); handleSearch(''); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Provider Selector Tabs */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--theme-text-secondary,#94a3b8)] text-[11px]">Provider:</span>
              {(['tenor', 'giphy', 'klipy'] as Provider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    provider === p 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-[var(--theme-surface-deep,#0d1117)] border border-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)] hover:text-white'
                  }`}
                >
                  {p === 'tenor' ? 'Tenor (Google)' : p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setQuery(cat);
                  handleSearch(cat);
                }}
                className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  query === cat 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' 
                    : 'bg-[var(--theme-border,#2e3440)]/40 hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]'
                }`}
              >
                {cat === 'Trending' ? <Flame className="w-3 h-3 inline mr-1 text-amber-400" /> : null}
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[260px] max-h-[380px]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-[var(--theme-text-secondary,#94a3b8)] py-12 gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Fetching GIFs...</span>
            </div>
          ) : gifs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-[var(--theme-text-secondary,#94a3b8)] py-12 gap-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span>No GIFs found for "{query}". Try a different term.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    onSelectGif(g);
                    onClose();
                  }}
                  className="group relative rounded-xl overflow-hidden aspect-video bg-[var(--theme-surface-deep,#0d1117)] border border-[var(--theme-border,#2e3440)] hover:border-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title={g.title}
                >
                  <img 
                    src={g.previewUrl || g.url} 
                    alt={g.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                    <span className="text-[10px] text-white truncate drop-shadow-md">
                      {g.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-[var(--theme-border,#2e3440)] text-[11px] text-[var(--theme-text-secondary,#94a3b8)] flex items-center justify-between bg-[var(--theme-surface-deep,#0d1117)]/50">
          <span>Click any GIF to attach to Google Chat</span>
          <span>Esc to cancel</span>
        </div>
      </div>
    </div>
  );
};
