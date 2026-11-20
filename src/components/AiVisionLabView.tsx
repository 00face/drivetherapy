/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI Vision & Face Clustering Lab (Low-Resource & Multi-Provider)
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Users,
  Tag,
  Search,
  Sliders,
  CheckCircle,
  Play,
  RotateCcw,
  Edit2,
  Check,
} from 'lucide-react';
import { MediaAsset } from '../types';
import {
  loadPeopleProfiles,
  persistPeopleProfiles,
  assignPersonName,
  PersonProfile,
} from '../services/faceRecognitionEngine';

interface AiVisionLabViewProps {
  assets: MediaAsset[];
  onFilterByTag: (tag: string) => void;
  onFilterByFace: (personLabel: string) => void;
  onBatchAnalyzeAll: () => void;
  isAnalyzing: boolean;
}

export const AiVisionLabView: React.FC<AiVisionLabViewProps> = ({
  assets,
  onFilterByTag,
  onFilterByFace,
  onBatchAnalyzeAll,
  isAnalyzing,
}) => {
  const [semanticQuery, setSemanticQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [peopleProfiles, setPeopleProfiles] = useState<PersonProfile[]>(() => loadPeopleProfiles());

  // Extract all unique faces from catalog assets
  const faceMap = new Map<string, { id: string; label: string; count: number; sampleImage: string }>();
  for (const asset of assets) {
    for (const face of asset.faces) {
      const existing = faceMap.get(face.label);
      if (existing) {
        existing.count += 1;
      } else {
        faceMap.set(face.label, {
          id: face.label,
          label: face.label,
          count: 1,
          sampleImage: asset.thumbnailUrl,
        });
      }
    }
  }

  // If assets don't have simulated faces yet, provide default discovered face clusters from portraits
  if (faceMap.size === 0 && assets.length > 0) {
    const portraitAssets = assets.filter(a => a.category === 'image' || a.category === 'raw');
    if (portraitAssets.length > 0) {
      faceMap.set('Alex (Hero)', {
        id: 'p_alex',
        label: 'Alex (Hero)',
        count: Math.min(portraitAssets.length, 12),
        sampleImage: portraitAssets[0]?.thumbnailUrl || '',
      });
      if (portraitAssets.length > 1) {
        faceMap.set('Sarah (Studio)', {
          id: 'p_sarah',
          label: 'Sarah (Studio)',
          count: Math.min(portraitAssets.length, 8),
          sampleImage: portraitAssets[1]?.thumbnailUrl || '',
        });
      }
    }
  }

  const facesList = Array.from(faceMap.values());

  const handleSavePersonName = (personId: string) => {
    if (!renameInput.trim()) return;
    const updated = assignPersonName(personId, renameInput.trim());
    setPeopleProfiles(updated);
    setEditingPersonId(null);
    setRenameInput('');
  };

  // Extract all tags with frequency
  const tagMap = new Map<string, number>();
  for (const asset of assets) {
    for (const tag of asset.tags) {
      tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
    }
  }
  const tagsList = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);

  const displayedAssets = assets.filter((asset) => {
    if (selectedPerson) {
      if (!asset.faces.some((f) => f.label === selectedPerson)) return false;
    }
    if (selectedTag) {
      if (!asset.tags.includes(selectedTag)) return false;
    }
    if (semanticQuery) {
      const q = semanticQuery.toLowerCase();
      const matchName = asset.name.toLowerCase().includes(q);
      const matchTag = asset.tags.some((t) => t.toLowerCase().includes(q));
      const matchReason = (asset.quality.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchTag && !matchReason) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header with Batch Analyze CTA */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-[#403993] via-[#1074B1] to-[#52B197] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <Sparkles className="w-4 h-4 text-[#BEBF61]" />
            <span>AI Vision &amp; Semantic Studio</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            Autonomous Library Categorization
          </h2>
          <p className="text-xs text-white/80 max-w-xl leading-relaxed">
            Scan thousands of frames for faces, aesthetic tags, and optical quality using your in-browser worker and multi-provider vision models.
          </p>
        </div>

        <button
          onClick={onBatchAnalyzeAll}
          disabled={isAnalyzing}
          className="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-50 font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
        >
          <Sparkles className={`w-4 h-4 text-[#1074B1] ${isAnalyzing ? 'animate-spin' : ''}`} />
          <span>{isAnalyzing ? 'Analyzing Library...' : 'Run Full Library Scan'}</span>
        </button>
      </div>

      {/* Semantic Natural Language Search Box */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            placeholder="Search concepts e.g. 'golden hour portrait', 'rain reflections', 'bamboo forest'..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#1074B1]"
          />
        </div>

        {/* Confidence Threshold Slider */}
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 shrink-0">
          <Sliders className="w-3.5 h-3.5 text-[#BEBF61]" />
          <span>Confidence:</span>
          <input
            type="range"
            min={40}
            max={95}
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseInt(e.target.value, 10))}
            className="w-20 accent-[#1074B1]"
          />
          <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100">{confidenceThreshold}%</span>
        </div>

        {(selectedPerson || selectedTag || semanticQuery) && (
          <button
            onClick={() => {
              setSelectedPerson(null);
              setSelectedTag(null);
              setSemanticQuery('');
            }}
            className="text-xs text-rose-500 hover:underline flex items-center gap-1 font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Face Clustering Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#1074B1]" />
            <span>Clustered People &amp; Faces</span>
          </h3>
          <span className="text-xs text-slate-400">{facesList.length} subjects detected</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {facesList.map((face) => {
            const isSelected = selectedPerson === face.label;
            return (
              <div
                key={face.label}
                onClick={() => {
                  const next = isSelected ? null : face.label;
                  setSelectedPerson(next);
                  onFilterByFace(next || '');
                }}
                className={`p-3 rounded-2xl bg-white dark:bg-[#151C2C] border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#1074B1] ring-2 ring-[#1074B1]/20 shadow-sm'
                    : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300'
                }`}
              >
                <img
                  src={face.sampleImage}
                  alt={face.label}
                  className="w-14 h-14 rounded-full mx-auto object-cover border-2 border-[#1074B1]/40 mb-2 shadow-xs"
                />
                <div className="text-center">
                  {editingPersonId === face.id ? (
                    <div
                      className="flex items-center gap-1 mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={renameInput}
                        autoFocus
                        onChange={(e) => setRenameInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSavePersonName(face.id);
                          if (e.key === 'Escape') setEditingPersonId(null);
                        }}
                        className="w-full px-1.5 py-0.5 text-[11px] rounded bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white border border-[#1074B1] focus:outline-none"
                      />
                      <button
                        onClick={() => handleSavePersonName(face.id)}
                        className="p-1 rounded bg-[#1074B1] text-white hover:bg-blue-600"
                        title="Save name"
                      >
                        <Check className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {face.label}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPersonId(face.id);
                          setRenameInput(face.label);
                        }}
                        className="p-0.5 rounded text-slate-400 hover:text-[#1074B1] opacity-0 group-hover:opacity-100 hover:opacity-100"
                        title="Rename person"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">
                    {face.count} {face.count === 1 ? 'photo' : 'photos'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Scene Tag Cloud */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-[#52B197]" />
            <span>Automated Scene &amp; Style Tags</span>
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {tagsList.map(([tag, count]) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => {
                  const next = isSelected ? null : tag;
                  setSelectedTag(next);
                  onFilterByTag(next || '');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[#1074B1] text-white shadow-xs'
                    : 'bg-white dark:bg-[#151C2C] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#1074B1]'
                }`}
              >
                <span>{tag}</span>
                <span className="ml-1.5 text-[10px] opacity-60 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtered Results Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Matched Media Items ({displayedAssets.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {displayedAssets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-2xl bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs group"
            >
              <div className="aspect-square bg-slate-100 dark:bg-slate-900 overflow-hidden">
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="p-2">
                <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {asset.name}
                </span>
                <span className="block text-[10px] text-slate-400 font-mono">
                  {asset.quality.sharpness}% sharp
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
