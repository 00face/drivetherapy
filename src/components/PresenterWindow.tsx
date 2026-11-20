/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dedicated Secondary Screen Fullscreen Presentation Viewer
 * Receives live slide synchronization via BroadcastChannel.
 */

import React, { useState, useEffect } from 'react';
import { loadAssets } from '../services/catalogDb';
import { MediaAsset } from '../types';

export const PresenterWindow: React.FC = () => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadAssets().then((items) => {
      if (items && items.length > 0) setAssets(items);
    });

    const channel = new BroadcastChannel('dt_presentation_sync');
    channel.onmessage = (e) => {
      if (typeof e.data?.index === 'number') {
        setCurrentIndex(e.data.index);
      }
    };

    return () => channel.close();
  }, []);

  const active = assets[currentIndex] || assets[0];

  if (!active) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center text-slate-500 font-mono text-sm">
        Waiting for presentation stream...
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none">
      <img
        src={active.thumbnailUrl}
        alt={active.name}
        className="max-w-full max-h-full object-contain transition-all duration-700 ease-out"
      />
      <div className="absolute bottom-4 left-6 text-white/50 text-xs font-mono">
        {currentIndex + 1} / {assets.length} · {active.name}
      </div>
    </div>
  );
};
