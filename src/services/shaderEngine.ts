/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native GPU Shader Engine (GLSL / Shadertoy / WGSL / HLSL)
 *  - Uniform & Macro Analyzer
 *  - Shadertoy mainImage() -> WebGL1/WebGL2 Fragment Wrapper Adapter
 *  - Line-Mapped WebGL Compiler Diagnostic Parser
 *  - Built-In Procedural Shader Presets & Deterministic CPU Fallback Renderer
 */

export interface ShaderUniformDecl {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface ShaderDiagnostic {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface ShaderPreset {
  id: string;
  label: string;
  description: string;
  fragmentSource: string;
}

export const SHADER_PRESETS: ShaderPreset[] = [
  {
    id: 'plasma-wave',
    label: 'Iridescent Plasma Wave',
    description: 'Smooth trig interference field with interactive u_paramA frequency & u_color1/2 mix',
    fragmentSource: `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform float u_paramA;
uniform float u_paramB;
uniform vec3 u_color1;
uniform vec3 u_color2;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / max(1.0, iResolution.y);
  float freq = 3.0 + u_paramA * 8.0;
  float v = sin(uv.x * freq + iTime) + sin(uv.y * freq - iTime * 0.8);
  v += sin((uv.x + uv.y) * freq * 0.7 + iTime * 1.3);
  float m = 0.5 + 0.5 * cos(v * (1.2 + u_paramB * 2.0));
  vec3 col = mix(u_color1, u_color2, m);
  float mouseGlow = exp(-6.0 * length(uv - (iMouse / max(vec2(1.0), iResolution) - 0.5)));
  col += vec3(0.25, 0.45, 0.7) * mouseGlow * 0.6;
  fragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'sdf-raymarch',
    label: 'SDF Raymarched Sphere & Rings',
    description: 'Signed-distance sphere with soft Fresnel rim lighting & procedural floor checker',
    fragmentSource: `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float u_paramA;
uniform float u_paramB;
uniform vec3 u_color1;
uniform vec3 u_color2;

float sdSphere(vec3 p, float r) { return length(p) - r; }

float mapScene(vec3 p) {
  vec3 q = p - vec3(0.0, 0.35 + 0.25 * sin(iTime * 1.4), 0.0);
  float d1 = sdSphere(q, 0.65 + u_paramA * 0.3);
  float d2 = p.y + 0.65;
  return min(d1, d2);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / max(1.0, iResolution.y);
  vec3 ro = vec3(0.0, 0.25, -2.5);
  vec3 rd = normalize(vec3(uv, 1.3));
  float t = 0.0;
  for (int i = 0; i < 48; i++) {
    float d = mapScene(ro + rd * t);
    if (d < 0.002 || t > 12.0) break;
    t += d;
  }
  vec3 col = mix(vec3(0.04, 0.07, 0.14), u_color2 * 0.25, clamp(uv.y + 0.5, 0.0, 1.0));
  if (t < 12.0) {
    vec3 p = ro + rd * t;
    vec2 e = vec2(0.002, 0.0);
    vec3 n = normalize(vec3(
      mapScene(p + e.xyy) - mapScene(p - e.xyy),
      mapScene(p + e.yxy) - mapScene(p - e.yxy),
      mapScene(p + e.yyx) - mapScene(p - e.yyx)
    ));
    vec3 l = normalize(vec3(cos(iTime), 1.2, sin(iTime)));
    float diff = max(dot(n, l), 0.0);
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    col = u_color1 * diff + u_color2 * fres * (0.4 + u_paramB);
  }
  fragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'fresnel-holo',
    label: 'Fresnel Hologram Scanlines',
    description: 'Cyberpunk scanline grid with animated chromatic pulse',
    fragmentSource: `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float u_paramA;
uniform vec3 u_color1;
uniform vec3 u_color2;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / max(vec2(1.0), iResolution.xy);
  float scan = 0.75 + 0.25 * sin(fragCoord.y * (0.3 + u_paramA * 1.2) - iTime * 12.0);
  float gridX = smoothstep(0.95, 1.0, abs(sin(uv.x * 30.0)));
  float gridY = smoothstep(0.95, 1.0, abs(sin(uv.y * 20.0 + iTime * 0.4)));
  vec3 col = mix(u_color1 * 0.18, u_color2, max(gridX, gridY)) * scan;
  fragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'ocean-caustics',
    label: 'Procedural Ocean Caustics',
    description: 'Layered Voronoi-like water caustic interference',
    fragmentSource: `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float u_paramA;
uniform vec3 u_color1;
uniform vec3 u_color2;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / max(vec2(1.0), iResolution.xy);
  vec2 p = uv * (4.0 + u_paramA * 6.0);
  float c = 0.0;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    p += vec2(sin(p.y * fi + iTime * 0.7), cos(p.x * fi - iTime * 0.6)) * 0.35;
    c += 1.0 / max(0.1, abs(sin(p.x) + cos(p.y)));
  }
  float glow = clamp(c * 0.08, 0.0, 1.0);
  fragColor = vec4(mix(u_color1 * 0.35, u_color2, glow), 1.0);
}`,
  },
];

export function extractShaderUniforms(source: string): ShaderUniformDecl[] {
  const uniforms: ShaderUniformDecl[] = [];
  const seen = new Set<string>();
  const regex = /^\s*uniform\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)\s*;/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const [, type, name] = match;
    if (!seen.has(name)) {
      seen.add(name);
      uniforms.push({ type, name });
    }
  }
  return uniforms;
}

/**
 * Parses WebGL / GLSL compiler log lines such as `ERROR: 0:14: 'foo' : undeclared identifier`
 */
export function parseWebGlCompilerLog(log: string, lineOffset = 0): ShaderDiagnostic[] {
  const diagnostics: ShaderDiagnostic[] = [];
  const lines = (log || '').split(/\r?\n/);
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^(ERROR|WARNING)\s*:\s*(\d+)\s*:\s*(\d+)\s*:\s*(.*)$/i);
    if (match) {
      const severity = match[1].toLowerCase() === 'warning' ? 'warning' : 'error';
      const col = Number(match[2]) || 0;
      const rawLine = Number(match[3]) || 1;
      const message = match[4].trim();
      diagnostics.push({
        line: Math.max(1, rawLine - lineOffset),
        column: col,
        severity,
        message,
      });
    } else if (trimmed.toLowerCase().includes('error') || trimmed.toLowerCase().includes('warning')) {
      diagnostics.push({
        line: 1,
        column: 0,
        severity: trimmed.toLowerCase().includes('warning') ? 'warning' : 'error',
        message: trimmed,
      });
    }
  }
  return diagnostics;
}

/**
 * Wraps Shadertoy `mainImage(out vec4, in vec2)` or standalone fragment shader into a complete WebGL1 fragment source.
 */
export function wrapFragmentShaderForWebGl(userSource: string): {
  fragmentSource: string;
  headerLineOffset: number;
} {
  const hasMain = /\bvoid\s+main\s*\(/.test(userSource);
  const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(userSource);
  const hasPrecision = /\bprecision\s+(lowp|mediump|highp)\s+float\s*;/.test(userSource);
  const hasUniformTime = /\buniform\s+float\s+iTime\b/.test(userSource);
  const hasUniformRes = /\buniform\s+vec2\s+iResolution\b/.test(userSource);

  const headerLines: string[] = [];
  if (!hasPrecision) headerLines.push('precision highp float;');
  if (!hasUniformTime) headerLines.push('uniform float iTime;');
  if (!hasUniformRes) headerLines.push('uniform vec2 iResolution;');
  if (!/\biMouse\b/.test(userSource)) headerLines.push('uniform vec2 iMouse;');
  if (!/\bu_paramA\b/.test(userSource)) headerLines.push('uniform float u_paramA;');
  if (!/\bu_paramB\b/.test(userSource)) headerLines.push('uniform float u_paramB;');
  if (!/\bu_color1\b/.test(userSource)) headerLines.push('uniform vec3 u_color1;');
  if (!/\bu_color2\b/.test(userSource)) headerLines.push('uniform vec3 u_color2;');

  const header = headerLines.length > 0 ? `${headerLines.join('\n')}\n` : '';
  const footer =
    !hasMain && hasMainImage
      ? `\nvoid main() {\n  vec4 outCol = vec4(0.0, 0.0, 0.0, 1.0);\n  mainImage(outCol, gl_FragCoord.xy);\n  gl_FragColor = outCol;\n}\n`
      : '';

  return {
    fragmentSource: `${header}${userSource}${footer}`,
    headerLineOffset: headerLines.length,
  };
}
