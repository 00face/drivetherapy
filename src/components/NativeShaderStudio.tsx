/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native Live GPU Shader Viewer & Editor Studio (GLSL / Shadertoy / WGSL / HLSL)
 * Real-time WebGL1/2 Fragment Sandbox, Line-Mapped Compiler Diagnostics,
 * Interactive Uniform Sliders (iTime, iMouse, u_paramA..B, u_color1..2),
 * Presets, PNG Frame Capture & Non-Destructive Save Copy.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Save,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Code2,
  Sliders,
  Tv,
} from 'lucide-react';
import type { MediaAsset } from '../types';
import { lookupFileFormat } from '../services/fileFormatEngine';
import { loadAssetContentSample } from '../services/universalFileViewerEngine';
import {
  SHADER_PRESETS,
  extractShaderUniforms,
  parseWebGlCompilerLog,
  wrapFragmentShaderForWebGl,
  type ShaderDiagnostic,
} from '../services/shaderEngine';

export interface NativeShaderStudioProps {
  asset: MediaAsset;
  compact?: boolean;
  onSaveEditedAsset?: (asset: MediaAsset, updatedText: string, saveToDisk?: boolean) => Promise<void> | void;
  onOpenFormatDb?: (query: string) => void;
  onOpenPip?: (asset: MediaAsset) => void;
  isPipActive?: boolean;
}

function hexToRgbNorm(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0.2,
    Number.isFinite(g) ? g : 0.6,
    Number.isFinite(b) ? b : 0.9,
  ];
}

export const NativeShaderStudio: React.FC<NativeShaderStudioProps> = ({
  asset,
  compact = false,
  onSaveEditedAsset,
  onOpenFormatDb,
  onOpenPip,
  isPipActive = false,
}) => {
  const fmt = useMemo(() => lookupFileFormat(asset.name, asset.mimeType), [asset.name, asset.mimeType]);

  const [source, setSource] = useState(SHADER_PRESETS[0].fragmentSource);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeSec, setTimeSec] = useState(0);
  const [paramA, setParamA] = useState(0.35);
  const [paramB, setParamB] = useState(0.5);
  const [color1, setColor1] = useState('#1d4ed8');
  const [color2, setColor2] = useState('#38bdf8');
  const [diagnostics, setDiagnostics] = useState<ShaderDiagnostic[]>([]);
  const [fps, setFps] = useState(60);
  const [webglStatus, setWebglStatus] = useState<'webgl' | 'fallback'>('webgl');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<[number, number]>([200, 150]);
  const timeRef = useRef(0);
  const paramsRef = useRef({ paramA, paramB, color1, color2, isPlaying });

  useEffect(() => {
    paramsRef.current = { paramA, paramB, color1, color2, isPlaying };
  }, [paramA, paramB, color1, color2, isPlaying]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sample = await loadAssetContentSample(asset, 131072);
      if (cancelled) return;
      if (
        sample.text &&
        !sample.isSynthesizedFallback &&
        (sample.text.includes('main') || sample.text.includes('uniform') || sample.text.includes('vec'))
      ) {
        setSource(sample.text);
      } else {
        setSource(SHADER_PRESETS[0].fragmentSource);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset, fmt]);

  const detectedUniforms = useMemo(() => extractShaderUniforms(source), [source]);

  // Live WebGL compilation & animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      setWebglStatus('fallback');
      return;
    }
    setWebglStatus('webgl');

    const vertSrc = `attribute vec2 a_pos;\nvoid main() {\n  gl_Position = vec4(a_pos, 0.0, 1.0);\n}`;
    const { fragmentSource, headerLineOffset } = wrapFragmentShaderForWebGl(source);

    const compileShader = (type: number, code: string): { shader: WebGLShader | null; log: string } => {
      const sh = gl.createShader(type);
      if (!sh) return { shader: null, log: 'Failed to create shader object' };
      gl.shaderSource(sh, code);
      gl.compileShader(sh);
      const ok = gl.getShaderParameter(sh, gl.COMPILE_STATUS);
      const log = gl.getShaderInfoLog(sh) || '';
      if (!ok) {
        gl.deleteShader(sh);
        return { shader: null, log };
      }
      return { shader: sh, log };
    };

    const vs = compileShader(gl.VERTEX_SHADER, vertSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs.shader || !fs.shader) {
      setDiagnostics(parseWebGlCompilerLog(fs.log || vs.log, headerLineOffset));
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs.shader);
    gl.attachShader(prog, fs.shader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setDiagnostics(parseWebGlCompilerLog(gl.getProgramInfoLog(prog) || 'Link error', headerLineOffset));
      return;
    }
    setDiagnostics([]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    const uTime = gl.getUniformLocation(prog, 'iTime');
    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uMouse = gl.getUniformLocation(prog, 'iMouse');
    const uParamA = gl.getUniformLocation(prog, 'u_paramA');
    const uParamB = gl.getUniformLocation(prog, 'u_paramB');
    const uCol1 = gl.getUniformLocation(prog, 'u_color1');
    const uCol2 = gl.getUniformLocation(prog, 'u_color2');

    let rafId = 0;
    let lastTs = performance.now();
    let frameCounter = 0;
    let fpsAccumulator = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      if (paramsRef.current.isPlaying) {
        timeRef.current += dt;
      }
      frameCounter++;
      fpsAccumulator += dt;
      if (fpsAccumulator >= 0.5) {
        setFps(Math.round(frameCounter / fpsAccumulator));
        setTimeSec(Number(timeRef.current.toFixed(2)));
        frameCounter = 0;
        fpsAccumulator = 0;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      if (uTime) gl.uniform1f(uTime, timeRef.current);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouseRef.current[0], mouseRef.current[1]);
      if (uParamA) gl.uniform1f(uParamA, paramsRef.current.paramA);
      if (uParamB) gl.uniform1f(uParamB, paramsRef.current.paramB);
      if (uCol1) {
        const [r, g, b] = hexToRgbNorm(paramsRef.current.color1);
        gl.uniform3f(uCol1, r, g, b);
      }
      if (uCol2) {
        const [r, g, b] = hexToRgbNorm(paramsRef.current.color2);
        gl.uniform3f(uCol2, r, g, b);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      gl.deleteProgram(prog);
      gl.deleteShader(vs.shader!);
      gl.deleteShader(fs.shader!);
      gl.deleteBuffer(buf);
    };
  }, [source]);

  const handleCapturePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${asset.name.replace(/\.[^/.]+$/, '')}_shader.png`;
    a.click();
  };

  const handleSave = async (saveToDisk: boolean) => {
    if (!onSaveEditedAsset) return;
    await onSaveEditedAsset(asset, source, saveToDisk);
    setSaveMessage(saveToDisk ? 'Saved non-destructive shader copy to disk' : 'Saved shader to Catalog');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div
      className={`rounded-3xl bg-slate-900 border border-slate-700 text-white flex flex-col overflow-hidden shadow-2xl ${
        compact ? 'w-[92vw] max-w-5xl max-h-[82vh]' : 'w-full min-h-[78vh]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold truncate">{asset.name}</span>
          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold uppercase">
            {fmt.extension} • Live Shader Studio
          </span>
          {diagnostics.length === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
              <CheckCircle2 className="w-3 h-3" /> Compiled ({fps} FPS)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px]">
              <AlertTriangle className="w-3 h-3" /> {diagnostics.length} Error(s)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-1.5"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              timeRef.current = 0;
              setTimeSec(0);
            }}
            className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset ({timeSec.toFixed(1)}s)</span>
          </button>
          <button
            type="button"
            onClick={handleCapturePng}
            className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          {onSaveEditedAsset && (
            <>
              <button
                type="button"
                onClick={() => void handleSave(false)}
                className="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                className="min-h-[36px] px-3 rounded-xl bg-[#1074B1] hover:bg-[#0e6499] font-bold flex items-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Save Copy</span>
              </button>
            </>
          )}
          {onOpenPip && (
            <button
              type="button"
              onClick={() => onOpenPip(asset)}
              aria-pressed={isPipActive}
              className={`min-h-[44px] px-3 rounded-xl font-bold flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                isPipActive ? 'bg-teal-600 text-white' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{isPipActive ? 'PiP Pinned' : 'Pin PiP'}</span>
            </button>
          )}
          {onOpenFormatDb && (
            <button
              type="button"
              onClick={() => onOpenFormatDb(fmt.extension)}
              className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 font-semibold"
            >
              Spec
            </button>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className="px-4 py-2 bg-emerald-950/70 border-b border-emerald-700/50 text-emerald-300 text-xs font-semibold">
          {saveMessage}
        </div>
      )}

      {/* Split Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left: Live Viewport + Uniform Controls */}
        <div className="lg:col-span-6 p-4 flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950/60 overflow-y-auto">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black">
            <canvas
              ref={canvasRef}
              width={640}
              height={400}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                mouseRef.current = [
                  ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
                  ((rect.height - (e.clientY - rect.top)) / rect.height) * e.currentTarget.height,
                ];
              }}
              className="w-full h-[280px] sm:h-[340px] object-cover block cursor-crosshair"
            />
            {webglStatus === 'fallback' && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-xs text-amber-300 p-4 text-center">
                WebGL context unavailable in this browser profile — compiler diagnostics & GLSL source editor remain active.
              </div>
            )}
          </div>

          {/* Preset Bar */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Shader Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SHADER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSource(preset.fragmentSource)}
                  className="min-h-[34px] px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Uniforms */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <Sliders className="w-3.5 h-3.5" />
              <span>Live Shader Uniforms</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="flex justify-between font-mono text-[11px] text-slate-300">
                  <span>u_paramA</span>
                  <span>{paramA.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={paramA}
                  onChange={(e) => setParamA(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </label>
              <label className="space-y-1">
                <span className="flex justify-between font-mono text-[11px] text-slate-300">
                  <span>u_paramB</span>
                  <span>{paramB.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={paramB}
                  onChange={(e) => setParamB(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-mono text-[11px] text-slate-300">u_color1</span>
                <input
                  type="color"
                  value={color1}
                  onChange={(e) => setColor1(e.target.value)}
                  className="w-8 h-6 rounded bg-transparent cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
                <span className="font-mono text-[11px] text-slate-300">u_color2</span>
                <input
                  type="color"
                  value={color2}
                  onChange={(e) => setColor2(e.target.value)}
                  className="w-8 h-6 rounded bg-transparent cursor-pointer"
                />
              </label>
            </div>
            {detectedUniforms.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {detectedUniforms.map((u) => (
                  <span
                    key={u.name}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                  >
                    {u.type} {u.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Code Editor + Line-Mapped Compiler Errors */}
        <div className="lg:col-span-6 flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 font-mono font-bold">
              <Code2 className="w-3.5 h-3.5 text-amber-400" />
              GLSL Fragment / Shadertoy Source
            </span>
            <span className="font-mono text-slate-400">{source.split('\n').length} lines</span>
          </div>

          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            aria-label="GLSL shader source editor"
            className="flex-1 min-h-[260px] p-4 bg-slate-950 text-emerald-300 font-mono text-xs leading-relaxed resize-none focus:outline-none"
          />

          {diagnostics.length > 0 && (
            <div className="max-h-36 overflow-y-auto border-t border-rose-800/60 bg-rose-950/60 p-3 space-y-1 text-xs font-mono text-rose-200">
              {diagnostics.map((d, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-100 font-bold shrink-0">
                    L{d.line}
                  </span>
                  <span>{d.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
