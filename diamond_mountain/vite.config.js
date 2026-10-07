import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyLegacyAssets() {
  return {
    name: 'copy-legacy-assets',
    writeBundle({ dir }) {
      const outputDir = resolve(dir);
      mkdirSync(resolve(outputDir, 'js'), { recursive: true });
      cpSync(resolve('js'), resolve(outputDir, 'js'), {
        recursive: true,
        filter: (source) => !source.includes(`${resolve('js', '_ignore')}`)
      });
      mkdirSync(resolve(outputDir, 'css'), { recursive: true });
      cpSync(resolve('css', 'style.css'), resolve(outputDir, 'css', 'style.css'));
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [vue(), copyLegacyAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
