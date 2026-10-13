import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'generated/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },
];