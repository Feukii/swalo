# Setup Code Validation Tooling

Set up ESLint v9, TypeScript strict, Jest, Prettier, Husky + lint-staged for NestJS + React Native/Expo monorepo.

## Documentation to Read

- FETCH: https://typescript-eslint.io/getting-started/
- FETCH: https://github.com/darraghoriordan/eslint-plugin-nestjs-typed
- FETCH: https://docs.expo.dev/develop/unit-testing/
- FETCH: https://github.com/lint-staged/lint-staged
- FETCH: https://docs.nestjs.com/fundamentals/testing

## Install Dependencies

### Root (monorepo)

```bash
pnpm add -D -w husky lint-staged prettier
```

### Backend (apps/api)

```bash
cd apps/api && pnpm add -D @darraghor/eslint-plugin-nestjs-typed @golevelup/ts-jest supertest @types/supertest jest-extended
```

### Mobile (apps/mobile)

```bash
cd apps/mobile && pnpm add -D jest-expo @testing-library/react-native @testing-library/jest-native
```

## Files to Create/Modify

### 1. `apps/api/eslint.config.mjs`

- ESLint v9 flat config
- typescript-eslint strict type-checked
- @darraghor/eslint-plugin-nestjs-typed flatRecommended
- eslint-plugin-prettier integration
- Ignore: dist, node_modules, coverage

### 2. `apps/mobile/eslint.config.mjs`

- eslint-config-expo/flat base
- typescript-eslint strict
- react-hooks rules (rules-of-hooks: error, exhaustive-deps: warn)
- eslint-plugin-prettier integration
- Ignore: node_modules, .expo, android, ios

### 3. `apps/api/tsconfig.json`

- strict: true
- noUncheckedIndexedAccess: true
- noImplicitOverride: true
- noImplicitReturns: true
- forceConsistentCasingInFileNames: true

### 4. `apps/mobile/tsconfig.json`

- extends: expo/tsconfig.base
- strict: true
- noUncheckedIndexedAccess: true
- noImplicitOverride: true
- moduleResolution: bundler

### 5. `apps/api/jest.config.ts`

- preset: ts-jest
- testEnvironment: node
- Coverage threshold: 70% (branches, functions, lines, statements)
- moduleNameMapper for src/\* paths
- setupFilesAfterEnv: jest-extended/all

### 6. `apps/api/jest-e2e.config.ts`

- Same as jest.config.ts but:
- testRegex: .e2e-spec.ts$
- maxWorkers: 1 (sequential)
- testTimeout: 30000

### 7. `apps/mobile/jest.config.js`

- preset: jest-expo/universal
- setupFilesAfterEnv: @testing-library/jest-native/extend-expect
- transformIgnorePatterns for node_modules exceptions

### 8. `.prettierrc` (root)

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

### 9. `lint-staged.config.js` (root)

- apps/api/\*_/_.ts: eslint --fix, prettier --write, type-check
- apps/mobile/\*_/_.{ts,tsx}: eslint --fix, prettier --write, type-check
- \*.{json,md}: prettier --write

### 10. `.husky/pre-commit`

```bash
pnpm exec lint-staged
```

### 11. UPDATE package.json scripts

**apps/api/package.json:**

```json
{
  "lint": "eslint \"{src,test}/**/*.ts\" --max-warnings=0",
  "type-check": "tsc --noEmit",
  "test": "jest",
  "test:e2e": "jest --config ./jest-e2e.config.ts",
  "test:cov": "jest --coverage",
  "validate": "pnpm run lint && pnpm run type-check && pnpm run test"
}
```

**apps/mobile/package.json:**

```json
{
  "lint": "eslint . --ext .ts,.tsx --max-warnings=0",
  "type-check": "tsc --noEmit",
  "test": "jest",
  "test:cov": "jest --coverage",
  "validate": "pnpm run lint && pnpm run type-check && pnpm run test"
}
```

**Root package.json:**

```json
{
  "validate": "turbo run validate",
  "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\"",
  "prepare": "husky"
}
```

## Validation Commands

After setup, run in sequence:

```bash
# Backend
pnpm --filter @swalo/api run lint
pnpm --filter @swalo/api run type-check
pnpm --filter @swalo/api run test

# Mobile
pnpm --filter @swalo/mobile run lint
pnpm --filter @swalo/mobile run type-check
pnpm --filter @swalo/mobile run test

# Full validation
pnpm run validate
```

## Expected Results

- All lint: 0 errors, 0 warnings
- All type-check: exit code 0
- All tests: passing
- Coverage: >= 70%

When everything is green, let the user know we are ready to commit.

## Output Format

Summary: [Tools installed and configured]
Files created: [list of new files]
Files modified: [list of updated files]
Validation results: [PASS/FAIL per command]
