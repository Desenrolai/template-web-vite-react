import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import { maxTestWorkers } from './tooling/cgroup-cpus.ts';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['{src,tooling}/**/*.test.{ts,tsx}', '*.test.mjs'],
    pool: 'threads',
    // Sem isto o pool dimensiona por os.cpus() — as CPUs do HOST, não as do
    // cgroup — e estoura o limite do container. Ver tooling/cgroup-cpus.ts.
    maxWorkers: maxTestWorkers(),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'tooling/**/*.ts', 'server.mjs'],
      exclude: ['src/main.tsx', '**/*.test.*'],
    },
  },
});
