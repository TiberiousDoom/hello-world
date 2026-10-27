// Lint (D-143): the recommended rules for JavaScript and TypeScript, plus the project's own:
// no `any`, and no Math.random or Math.hypot in the rules (co-op games must compute the same numbers).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dist-single/', 'dist-server/', 'relay/', 'node_modules/', 'playwright-report/', 'test-results/', 'audio/', 'art/', 'pwa/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    ignores: ['src/sim/**/*.test.ts', 'src/sim/mapgen.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'hypot', message: 'Use hypot from math.ts: co-op games must compute the same numbers.' },
        { object: 'Math', property: 'random', message: 'Use w.random(): the rules are seeded.' },
      ],
    },
  },
);
