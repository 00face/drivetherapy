import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function sanitizeCssWarnings(): Plugin {
  const sanitize = (css: string) => {
    return css
      .replace(/-moz-osx-font-smoothing:\s*grayscale;?/g, '')
      .replace(/-webkit-text-size-adjust:\s*100%;?/g, 'text-size-adjust: 100%;');
  };

  return {
    name: 'sanitize-css-warnings',
    enforce: 'post',
    transform(code, id) {
      if (id.endsWith('.css') || id.includes('.css?')) {
        return {
          code: sanitize(code),
          map: null,
        };
      }
    },
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.source && typeof file.source === 'string') {
          file.source = sanitize(file.source);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sanitizeCssWarnings()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-react', test: /node_modules\/(react|react-dom|scheduler)\//, priority: 30 },
              { name: 'vendor-icons', test: /node_modules\/lucide-react\//, priority: 25 },
              { name: 'vendor-firebase', test: /node_modules\/(@?firebase|idb)\//, priority: 20 },
              { name: 'vendor-ai-wasm', test: /node_modules\/(@huggingface|onnxruntime-web|tesseract\.js)\//, priority: 20 },
              { name: 'i18n-data', test: /src\/(i18n\/locales|data\/fileFormatsDatabase)/, priority: 15 },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
