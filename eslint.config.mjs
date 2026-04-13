import { fixupPluginRules } from '@eslint/compat';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactNative from 'eslint-plugin-react-native';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'android/', 'ios/', '*.config.js', '*.config.mjs', 'dist/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      react: fixupPluginRules(react),
      'react-hooks': fixupPluginRules(reactHooks),
      'react-native': fixupPluginRules(reactNative),
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // TypeScript
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',

      // React
      ...react.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/no-inline-styles': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Prettier (disables conflicting rules)
      ...prettier.rules,
    },
  },
];
