import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
const config = tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  // TypeScript da aplicação (browser).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Convenção do projeto: zero `any`.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // TypeScript que roda em Node: só troca os globals, mantendo o parser e as
  // regras de TS acima (`no-unused-vars` base não entende tipos e dá falso
  // positivo em parâmetro tipado).
  {
    files: ['tooling/**/*.ts', 'vite.config.ts', 'vitest.config.ts', 'vitest.setup.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // JavaScript que roda em Node: o static server de produção.
  {
    files: ['**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },
);

export default config;
