import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': 'off',
    },
  },
  {
    // Gameplay logic must stay headless: no Three.js (or other render/DOM deps) in sim code.
    files: ['src/core/**', 'src/systems/**', 'src/components/**', 'src/content/**', 'src/game.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'three', message: 'Sim code must not import Three.js. Rendering is a read-only view of ECS state.' },
            { name: 'howler', message: 'Sim code must not import audio. Emit events instead.' },
          ],
          patterns: ['three/*'],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'Sim code must be headless (no DOM).' },
        { name: 'window', message: 'Sim code must be headless (no DOM).' },
        { name: 'navigator', message: 'Sim code must be headless (no DOM).' },
      ],
    },
  },
);
