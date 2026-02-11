Run comprehensive validation of the project to ensure all tests, type checks, linting, and deployments are working correctly.

Execute the following commands in sequence and report results:

## 1. Backend (NestJS) - Linting

```bash
pnpm --filter @swalo/api run lint
```

**Expected:** 0 errors, 0 warnings

## 2. Backend - Type Checking

```bash
pnpm --filter @swalo/api run type-check
```

**Expected:** No TypeScript errors (tsc --noEmit exits 0)

## 3. Backend - Unit Tests

```bash
pnpm --filter @swalo/api run test
```

**Expected:** All tests pass

## 4. Backend - E2E Tests

```bash
pnpm --filter @swalo/api run test:e2e
```

**Expected:** All E2E tests pass (Supertest)

## 5. Mobile (Expo/RN) - Linting

```bash
pnpm --filter @swalo/mobile run lint
```

**Expected:** 0 errors, 0 warnings

## 6. Mobile - Type Checking

```bash
pnpm --filter @swalo/mobile run type-check
```

**Expected:** No TypeScript errors

## 7. Mobile - Tests

```bash
pnpm --filter @swalo/mobile run test
```

**Expected:** All component tests pass (Jest + RNTL)

## 8. Full Monorepo Validation (Turborepo)

```bash
pnpm run validate
```

**Expected:** All workspaces pass lint, type-check, and test

## 9. Prettier Format Check

```bash
pnpm run format:check
```

**Expected:** All files properly formatted

## 10. Summary Report

After all validations complete, provide a summary report with:

| Workspace | Lint      | Types     | Tests     |
| --------- | --------- | --------- | --------- |
| Backend   | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Mobile    | PASS/FAIL | PASS/FAIL | PASS/FAIL |

- Any errors or warnings encountered
- Overall health assessment (PASS/FAIL)

**Format the report clearly with sections and status indicators**
Make sure to don't put emojis in the code
