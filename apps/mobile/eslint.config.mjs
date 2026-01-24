import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'dist/**', 'coverage/**'],
  },

  // Base recommended configs
  eslint.configs.recommended,

  // TypeScript strict config
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // Language options
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },

  // React Hooks rules
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Custom TypeScript rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },

  // Prettier integration (must be last)
  eslintPluginPrettier
);
