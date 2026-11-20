/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 5-Mode Real-Time Web Audio FFT Visualizer Renderer
 * Pure Canvas 2D renderer supporting Spectrum, Radial, Waveform, Mirror, and Ambient modes.
 */

export type VisualizerMode = 'spectrum' | 'radial' | 'waveform' | 'mirror' | 'ambient';

export const VISUALIZER_MODES: Array<{ id: VisualizerMode; label: string }> = [
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'radial', label: 'Radial' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'mirror', label: 'Mirror' },
  { id: 'ambient', label: 'Ambient' },
];

export interface VisualizerCanvasContextLike {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  stroke: () => void;
  fill: () => void;
  createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
    addColorStop: (offset: number, color: string) => void;
  };
  fillStyle: string | any;
  strokeStyle: string | any;
  lineWidth: number;
}

function sampleValue(
  spectrum: Uint8Array | number[],
  index: number,
  phase: number,
  isPlaying: boolean,
  calmMotion: boolean
): number {
  const raw = spectrum[index] || 0;
  if (!isPlaying || calmMotion) {
    return raw || Math.abs(Math.sin(index * 0.35) * 36) + 16;
  }
  if (raw === 0) {
    return Math.abs(Math.sin(phase + index * 0.28) * 125 + Math.cos(phase * 1.4 + index * 0.45) * 55);
  }
  return raw;
}

export function drawVisualizerFrame(
  ctx: VisualizerCanvasContextLike,
  width: number,
  height: number,
  spectrum: Uint8Array | number[],
  mode: VisualizerMode,
  phase: number,
  isPlaying: boolean,
  calmMotion: boolean
): void {
  ctx.clearRect(0, 0, width, height);

  if (mode === 'radial') {
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.max(8, Math.min(width, height) * 0.26);
    const bars = 40;
    for (let i = 0; i < bars; i++) {
      const val = sampleValue(spectrum, i, phase, isPlaying, calmMotion);
      const len = Math.max(3, (val / 255) * (Math.min(width, height) * 0.22));
      const a = (i / bars) * Math.PI * 2 + (calmMotion ? 0 : phase * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * baseRadius, cy + Math.sin(a) * baseRadius);
      ctx.lineTo(cx + Math.cos(a) * (baseRadius + len), cy + Math.sin(a) * (baseRadius + len));
      ctx.strokeStyle = i % 3 === 0 ? '#1074B1' : i % 3 === 1 ? '#52B197' : '#BEBF61';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    return;
  }

  if (mode === 'waveform') {
    const points = 64;
    const step = width / (points - 1);
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const val = sampleValue(spectrum, i, phase, isPlaying, calmMotion);
      const offset = ((val / 255) - 0.5) * height * 0.85 * (i % 2 === 0 ? 1 : -1);
      const x = i * step;
      const y = height / 2 + offset * 0.65;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#52B197';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    return;
  }

  if (mode === 'mirror') {
    const numBars = 40;
    const barWidth = width / numBars;
    const midY = height / 2;
    for (let i = 0; i < numBars; i++) {
      const val = sampleValue(spectrum, i, phase, isPlaying, calmMotion);
      const halfH = Math.max(2, (val / 255) * midY * 0.88);
      const grad = ctx.createLinearGradient(0, midY - halfH, 0, midY + halfH);
      grad.addColorStop(0, '#A61B7A');
      grad.addColorStop(0.5, '#1074B1');
      grad.addColorStop(1, '#52B197');
      ctx.fillStyle = grad;
      ctx.fillRect(i * barWidth + 1, midY - halfH, Math.max(1, barWidth - 2), halfH * 2);
    }
    return;
  }

  if (mode === 'ambient') {
    let bassSum = 0;
    for (let i = 0; i < 8; i++) {
      bassSum += sampleValue(spectrum, i, phase, isPlaying, calmMotion);
    }
    const energy = bassSum / (8 * 255);
    const radius = Math.max(10, Math.min(width, height) * (0.28 + energy * 0.22));
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(16, 116, 177, 0.55)');
    grad.addColorStop(0.5, 'rgba(82, 177, 151, 0.45)');
    grad.addColorStop(1, 'rgba(166, 27, 122, 0.50)');
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    return;
  }

  // Default: 'spectrum'
  const numBars = 48;
  const barWidth = width / numBars;
  for (let i = 0; i < numBars; i++) {
    const val = sampleValue(spectrum, i, phase, isPlaying, calmMotion);
    const barHeight = Math.max(4, (val / 255) * height * 0.85);
    const x = i * barWidth;
    const y = height - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, '#1074B1');
    gradient.addColorStop(0.5, '#52B197');
    gradient.addColorStop(1, '#BEBF61');
    ctx.fillStyle = gradient;
    ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
  }
}
