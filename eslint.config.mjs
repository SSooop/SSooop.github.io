import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astroPlugin from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astroPlugin.configs.recommended,
  {
    files: ['**/*.astro'],
    ...(astroPlugin.configs['jsx-a11y-strict']?.overrides || []).flatMap((override) =>
      override.files?.includes('*.astro') ? override : []
    ),
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tools/writer-studio/{server,server.test,task-workspace}.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tools/writer-studio/public/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: [
      'dist',
      'dist/**',
      '.astro',
      '.astro/**',
      '.cache',
      '.cache/**',
      'node_modules',
      'node_modules/**',
      '.pnpm-store',
      '.pnpm-store/**',
      'src/env.d.ts',
      'build',
      'build/**',
      'coverage',
      'coverage/**',
      'out',
      'out/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
];
