import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintNestJs from '@darraghor/eslint-plugin-nestjs-typed';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.js', '**/*.mjs', 'test/integration/**'],
  },

  // Base recommended configs
  eslint.configs.recommended,

  // TypeScript strict type-checked config
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser configuration
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // NestJS typed plugin recommended config
  eslintNestJs.configs.flatRecommended,

  // Custom rules for this project
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript specific overrides for NestJS patterns
      '@typescript-eslint/no-extraneous-class': 'off', // NestJS modules are empty classes
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Relax some strict rules for practical NestJS development
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'warn',

      // Disable NestJS Swagger-related rules (enable when adding Swagger)
      '@darraghor/nestjs-typed/api-method-should-specify-api-response': 'off',
      '@darraghor/nestjs-typed/controllers-should-supply-api-tags': 'off',
      '@darraghor/nestjs-typed/injectable-should-be-provided': 'off',
      '@darraghor/nestjs-typed/validation-pipe-should-use-forbid-unknown': 'warn',
    },
  },

  // Prettier integration (must be last)
  eslintPluginPrettier
);
