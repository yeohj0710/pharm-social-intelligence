import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function dataFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? dataFiles(path) : [path];
  });
}

function dataVersion() {
  const root = resolve('public/data');
  const hash = createHash('sha256');
  for (const path of dataFiles(root).sort()) {
    hash.update(path.slice(root.length));
    hash.update(readFileSync(path));
    hash.update(String(statSync(path).size));
  }
  return hash.digest('hex').slice(0, 16);
}

export default defineConfig({
  plugins: [react()],
  define: {
    __PHARM_DATA_VERSION__: JSON.stringify(dataVersion()),
  },
});
