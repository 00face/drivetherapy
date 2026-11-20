import React, { useState, useEffect } from 'react';
import { 
  X, 
  HardDrive, 
  Folder, 
  Image as ImageIcon, 
  BookOpen, 
  Search, 
  Check, 
  Upload, 
  FileText, 
  Film, 
  Music,
  ExternalLink
} from 'lucide-react';
import { MediaAsset } from '../types';
import { loadAssets } from '../services/catalogDb';
import { notebookLmDossierGenerator } from '../services/notebookLmDossierGenerator';

export interface ChatAttachmentItem {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes?: number;
  source: 'drive' | 'local' | 'photos' | 'notebooklm';
  thumbnailUrl?: string;
}

interface GoogleChatWorkspaceAttachModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAttach: (items: ChatAttachmentItem[]) => void;
}

type TabType = 'drive' | 'local' | 'photos' | 'notebooklm';

export const GoogleChatWorkspaceAttachModal: React.FC<GoogleChatWorkspaceAttachModalProps> = ({
  isOpen,
  onClose,
  onAttach
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('drive');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDossier, setSelectedDossier] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAssets().then(loaded => {
        setAssets(loaded);
      }).catch(() => setAssets([]));
    } else {
      setSelectedIds(new Set());
      setSelectedDossier(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachmentItem[] = Array.from(files).map((f, idx) => ({
      id: `local-upload-${Date.now()}-${idx}`,
      name: f.name,
      url: URL.createObjectURL(f),
      mimeType: f.type || 'application/octet-stream',
      sizeBytes: f.size,
      source: 'local'
    }));

    onAttach(newAttachments);
    onClose();
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = !searchQuery || 
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'drive') return a.source === 'cloud' || !a.source;
    if (activeTab === 'local') return a.source === 'local';
    if (activeTab === 'photos') return a.category === 'image' || a.category === 'raw';
    return true;
  });

  const handleConfirmAttach = () => {
    if (activeTab === 'notebooklm') {
      const dossier = notebookLmDossierGenerator.generateDossier(assets, {
        title: selectedDossier || 'Drive Therapy Studio Brief',
        includeFullCullingSummary: true,
        includeExifBreakdown: true,
        includePaletteAnalysis: true
      });
      const blob = new Blob([dossier.markdownContent], { type: 'text/markdown' });
      const item: ChatAttachmentItem = {
        id: `notebooklm-${Date.now()}`,
        name: dossier.filename,
        url: URL.createObjectURL(blob),
        mimeType: 'text/markdown',
        sizeBytes: blob.size,
        source: 'notebooklm'
      };
      onAttach([item]);
      onClose();
      return;
    }

    const selectedItems = assets
      .filter(a => selectedIds.has(a.id))
      .map(a => ({
        id: a.id,
        name: a.name,
        url: a.cloudUrl || a.thumbnailUrl || a.path,
        mimeType: a.mimeType || 'application/octet-stream',
        sizeBytes: a.sizeBytes,
        source: (a.source === 'local' ? 'local' : (activeTab === 'photos' ? 'photos' : 'drive')) as ChatAttachmentItem['source'],
        thumbnailUrl: a.thumbnailUrl
      }));

    onAttach(selectedItems);
    onClose();
  };

  const dossiers = [
    { id: 'brief-main', title: 'Studio Production & Culling Dossier', desc: 'Summary of all picked assets, color labels, and ratings' },
    { id: 'brief-exif', title: 'Camera & Lens Technical Dossier', desc: 'Camera bodies, focal lengths, apertures, and ISO telemetry' },
    { id: 'brief-palette', title: 'Color Palette & Atmospheric Profile', desc: 'Dominant 5-color palettes and tone curves for grading' }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[var(--theme-surface,#181b22)] border border-[var(--theme-border,#2e3440)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[var(--theme-text,#eceff4)] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--theme-border,#2e3440)]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <HardDrive className="w-4 h-4" />
            </span>
            <span className="font-semibold text-base">Attach to Google Chat</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]">
              Cross-Workspace
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-[var(--theme-border,#2e3440)] bg-[var(--theme-surface-deep,#0d1117)]/40 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'drive'
                ? 'border-blue-500 text-blue-400 bg-[var(--theme-surface,#181b22)]'
                : 'border-transparent text-[var(--theme-text-secondary,#94a3b8)] hover:text-white hover:bg-[var(--theme-border,#2e3440)]/40'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'local'
                ? 'border-blue-500 text-blue-400 bg-[var(--theme-surface,#181b22)]'
                : 'border-transparent text-[var(--theme-text-secondary,#94a3b8)] hover:text-white hover:bg-[var(--theme-border,#2e3440)]/40'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Local Storage</span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'photos'
                ? 'border-blue-500 text-blue-400 bg-[var(--theme-surface,#181b22)]'
                : 'border-transparent text-[var(--theme-text-secondary,#94a3b8)] hover:text-white hover:bg-[var(--theme-border,#2e3440)]/40'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Google Photos</span>
          </button>

          <button
            onClick={() => setActiveTab('notebooklm')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'notebooklm'
                ? 'border-blue-500 text-blue-400 bg-[var(--theme-surface,#181b22)]'
                : 'border-transparent text-[var(--theme-text-secondary,#94a3b8)] hover:text-white hover:bg-[var(--theme-border,#2e3440)]/40'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>NotebookLM Brief</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {activeTab === 'notebooklm' ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--theme-text-secondary,#94a3b8)]">
                Select a dossier report generated from your current catalog to attach to Google Chat as a clean Markdown source:
              </p>
              <div className="grid gap-2">
                {dossiers.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDossier(d.title)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                      selectedDossier === d.title
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[var(--theme-border,#2e3440)] hover:border-gray-500 bg-[var(--theme-surface-deep,#0d1117)]'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{d.title}</div>
                      <div className="text-xs text-[var(--theme-text-secondary,#94a3b8)] mt-0.5">{d.desc}</div>
                    </div>
                    {selectedDossier === d.title && (
                      <span className="p-1 rounded-full bg-blue-500 text-white">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search & Upload bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-secondary,#94a3b8)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTab === 'photos' ? 'photos' : 'files'}...`}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--theme-surface-deep,#0d1117)] border border-[var(--theme-border,#2e3440)] text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                {activeTab === 'local' && (
                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Local File</span>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                )}
              </div>

              {/* Items List / Grid */}
              {filteredAssets.length === 0 ? (
                <div className="text-center py-12 text-xs text-[var(--theme-text-secondary,#94a3b8)]">
                  No assets found in {activeTab}.
                </div>
              ) : activeTab === 'photos' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {filteredAssets.map(asset => {
                    const isSelected = selectedIds.has(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleSelect(asset.id)}
                        className={`group relative rounded-xl overflow-hidden aspect-square bg-[var(--theme-surface-deep,#0d1117)] border cursor-pointer transition-all ${
                          isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-[var(--theme-border,#2e3440)] hover:border-gray-500'
                        }`}
                      >
                        <img 
                          src={asset.thumbnailUrl || asset.path} 
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        <div className="absolute top-1.5 right-1.5">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-black/60 text-transparent border border-white/40'
                          }`}>
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[10px] text-white truncate">{asset.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-[var(--theme-border,#2e3440)] border border-[var(--theme-border,#2e3440)] rounded-xl overflow-hidden bg-[var(--theme-surface-deep,#0d1117)]/30">
                  {filteredAssets.map(asset => {
                    const isSelected = selectedIds.has(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleSelect(asset.id)}
                        className={`flex items-center justify-between p-2.5 hover:bg-white/5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-500 bg-transparent'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="p-1.5 rounded-lg bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)]">
                            {asset.category === 'video' ? <Film className="w-4 h-4 text-purple-400" /> :
                             asset.category === 'audio' ? <Music className="w-4 h-4 text-emerald-400" /> :
                             <FileText className="w-4 h-4 text-blue-400" />}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium truncate">{asset.name}</p>
                            <p className="text-[10px] text-[var(--theme-text-secondary,#94a3b8)]">
                              {(asset.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {asset.mimeType}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-[var(--theme-text-secondary,#94a3b8)] uppercase px-2 py-0.5 rounded bg-[var(--theme-border,#2e3440)]">
                          {asset.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--theme-border,#2e3440)] bg-[var(--theme-surface-deep,#0d1117)]/50">
          <div className="text-xs text-[var(--theme-text-secondary,#94a3b8)]">
            {activeTab === 'notebooklm' ? (
              <span>{selectedDossier ? `Selected: ${selectedDossier}` : 'Select a dossier to attach'}</span>
            ) : (
              <span>{selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} selected</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs rounded-xl hover:bg-[var(--theme-border,#2e3440)] text-[var(--theme-text-secondary,#94a3b8)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAttach}
              disabled={activeTab === 'notebooklm' ? !selectedDossier : selectedIds.size === 0}
              className="px-4 py-1.5 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white shadow-sm transition-all"
            >
              Attach to Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
