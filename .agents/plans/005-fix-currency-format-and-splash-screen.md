# Feature: Fix Currency Format and Splash Screen Uniformity

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

This plan addresses two bug fixes for the SWALO mobile application:

1. **Currency Formatting Cleanup**: Remove legacy currency formatting code that incorrectly handles centimes. The project uses XOF/FCFA (West African CFA franc) which has NO decimal places. Amounts should display with space as thousand separator (e.g., "1 000 000 F").

2. **Splash Screen Uniformity**: Update the splash screen configuration to match the app's theme colors. The background should be consistent with the app's primary color scheme (#0F2A44 "Bleu pétrole") instead of white (#ffffff).

## User Story

As a SWALO mobile app user
I want to see currency amounts formatted consistently without decimals and with proper spacing
So that I can easily read financial amounts in the local XOF/FCFA format

As a SWALO mobile app user
I want the splash screen to have a consistent visual appearance with the rest of the app
So that I experience a cohesive brand identity from app launch

## Problem Statement

1. **Currency**: A legacy `currency.ts` file exists that divides amounts by 100 (assuming centimes) and uses `toLocaleString('fr-FR')` which may add decimals. This contradicts the project requirement of NO centimes. While currently unused, this dead code creates confusion and technical debt.

2. **Splash Screen**: The splash screen uses a white background (#ffffff) while the app uses a dark blue primary color (#0F2A44 "Bleu pétrole"). This creates a jarring visual transition when the app launches.

## Solution Statement

1. **Currency**: Delete the unused legacy `currency.ts` file. The existing `money.ts` already correctly implements the required format ("1 000 000 F" with space separator, no decimals).

2. **Splash Screen**: Update `app.config.ts` to use the app's primary background color (#F8FAFC - the app background) or primary color (#0F2A44) for the splash screen, ensuring visual continuity.

## Feature Metadata

**Feature Type**: Bug Fix
**Estimated Complexity**: Low
**Primary Systems Affected**: Mobile app utilities, Mobile app configuration
**Dependencies**: None (internal changes only)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `apps/mobile/src/utils/money.ts` (lines 1-42) - Why: Contains the CORRECT money formatting implementation that should remain unchanged
- `apps/mobile/src/utils/currency.ts` (lines 1-11) - Why: Contains the LEGACY/INCORRECT implementation that should be DELETED
- `apps/mobile/app.config.ts` (lines 16-20) - Why: Contains splash screen configuration that needs background color update
- `apps/mobile/src/constants/theme-v2.ts` (lines 1-38) - Why: Contains the app's color definitions including primary (#0F2A44) and background (#F8FAFC)

### New Files to Create

- None - this is a cleanup and configuration change only

### Files to Delete

- `apps/mobile/src/utils/currency.ts` - Legacy unused file with incorrect centimes logic

### Relevant Documentation

- Expo Splash Screen documentation: https://docs.expo.dev/versions/latest/sdk/splash-screen/
- Expo app.config.ts reference: https://docs.expo.dev/versions/latest/config/app/

### Patterns to Follow

**Currency Formatting Pattern (from money.ts):**

- Use regex for thousand separator: `.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')`
- No decimals: `.toFixed(0)`
- Suffix with "F": `${formatted} F`
- Handle edge cases: undefined, null, NaN

**Theme Color Pattern (from theme-v2.ts):**

- Primary color: `Colors.primary[900]` = `#0F2A44` (Bleu pétrole)
- Background: `Colors.background` = `#F8FAFC`
- These are the authoritative color values for the app

---

## IMPLEMENTATION PLAN

### Phase 1: Verification

Verify the current state of the codebase:

- Confirm `currency.ts` is truly unused (no imports)
- Confirm `money.ts` is the active formatting utility
- Review current splash screen appearance

### Phase 2: Code Cleanup

Remove the legacy currency utility:

- Delete `apps/mobile/src/utils/currency.ts`
- Verify no broken imports result

### Phase 3: Configuration Update

Update splash screen configuration:

- Modify `app.config.ts` splash backgroundColor
- Choose between `#F8FAFC` (light background) or `#0F2A44` (primary color)

### Phase 4: Testing & Validation

Test the changes:

- Run linting to catch any broken imports
- Test app launch to verify splash screen appearance
- Verify money formatting still works correctly

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: VERIFY - Confirm currency.ts is unused

- **IMPLEMENT**: Search the entire mobile codebase for any imports of `formatCurrency` from `currency.ts` or any reference to the `currency.ts` file
- **PATTERN**: Use grep/search to find imports matching `from.*currency` or `formatCurrency`
- **DEPENDENCIES**: None
- **GOTCHA**: Check for both relative imports (`../utils/currency`) and potential barrel exports
- **VALIDATE**: `cd apps/mobile && grep -r "formatCurrency\|from.*['\"].*currency['\"]" src/ --include="*.ts" --include="*.tsx"`
- **TEST_REQUIREMENT**: Search should return zero results (file is unused)

### Task 2: DELETE - Remove legacy currency.ts file

- **IMPLEMENT**: Delete the file `apps/mobile/src/utils/currency.ts` entirely
- **PATTERN**: Standard file deletion
- **DEPENDENCIES**: Task 1 must confirm file is unused
- **GOTCHA**: Ensure no index.ts barrel export references this file
- **VALIDATE**: `ls apps/mobile/src/utils/currency.ts` should return "file not found"
- **TEST_REQUIREMENT**: File no longer exists

### Task 3: VERIFY - Check for barrel export in utils/index.ts

- **IMPLEMENT**: Check if there's a utils/index.ts that exports from currency.ts and remove that export if present
- **PATTERN**: Check for barrel export pattern `export * from './currency'`
- **DEPENDENCIES**: None
- **GOTCHA**: May not exist - that's OK
- **VALIDATE**: `cat apps/mobile/src/utils/index.ts 2>/dev/null || echo "No barrel export file"`
- **TEST_REQUIREMENT**: No references to currency in any barrel exports

### Task 4: UPDATE - Change splash screen background color

- **IMPLEMENT**: In `apps/mobile/app.config.ts`, change the splash.backgroundColor from `#ffffff` to `#F8FAFC` (app background color for light, consistent look)
- **PATTERN**: Follow existing config structure in app.config.ts
- **DEPENDENCIES**: None
- **GOTCHA**: The value must be a valid hex color string. Using `#F8FAFC` (light gray) provides good contrast with the logo while matching the app's background
- **RESOURCES**: https://docs.expo.dev/versions/latest/config/app/#backgroundcolor
- **VALIDATE**: `grep -A3 "splash:" apps/mobile/app.config.ts | grep backgroundColor`
- **TEST_REQUIREMENT**: backgroundColor should show `#F8FAFC`

### Task 5: UPDATE - Align Android adaptive icon background (optional)

- **IMPLEMENT**: Consider updating Android adaptive icon backgroundColor from `#1E3A8A` to `#0F2A44` to match the app's primary color exactly
- **PATTERN**: Follow existing config structure in app.config.ts android.adaptiveIcon section
- **DEPENDENCIES**: None
- **GOTCHA**: This affects Android only. Current value `#1E3A8A` is close but not exact match to theme primary `#0F2A44`
- **VALIDATE**: `grep -A3 "adaptiveIcon:" apps/mobile/app.config.ts | grep backgroundColor`
- **TEST_REQUIREMENT**: backgroundColor should show `#0F2A44`

### Task 6: VALIDATE - Run linting to verify no broken imports

- **IMPLEMENT**: Run ESLint on the mobile app to ensure no broken imports from deleted file
- **PATTERN**: Standard lint command from package.json
- **DEPENDENCIES**: Tasks 2, 3 completed
- **GOTCHA**: May have warnings unrelated to this change - focus on import errors
- **VALIDATE**: `cd apps/mobile && pnpm run lint`
- **TEST_REQUIREMENT**: No errors related to currency.ts or formatCurrency imports

### Task 7: VALIDATE - Run TypeScript type check

- **IMPLEMENT**: Run TypeScript compiler to verify no type errors from deleted file
- **PATTERN**: Standard type-check command from package.json
- **DEPENDENCIES**: Tasks 2, 3 completed
- **GOTCHA**: May have existing type warnings - focus on import-related errors
- **VALIDATE**: `cd apps/mobile && pnpm run type-check`
- **TEST_REQUIREMENT**: No errors related to missing currency module

---

## TESTING STRATEGY

### Unit Tests

**Scope**: Money formatting utility
**Requirements**:

- Verify `formatMoney()` correctly formats amounts with space separator
- Verify no decimals are added
- Test edge cases: 0, negative, large numbers, null/undefined

**Test Categories Required**:

- `formatMoney(1000000)` returns `"1 000 000 F"`
- `formatMoney(1500)` returns `"1 500 F"`
- `formatMoney(0)` returns `"0 F"`
- `formatMoney(-500)` returns `"500 F"` (absolute value)
- `formatMoney(null)` returns `"0 F"`
- `formatMoney(undefined)` returns `"0 F"`

**VALIDATION COMMAND**: `cd apps/mobile && pnpm run test`

### Integration Tests

**Scope**: App startup and splash screen
**Requirements**:

- App should start without import errors
- Splash screen should display with new background color

**VALIDATION COMMAND**: `cd apps/mobile && npx expo start` (manual visual verification)

### Edge Cases

**MANDATORY EDGE CASES TO TEST**:

- Large amounts: 1,000,000,000 F (billion)
- Small amounts: 1 F, 10 F, 100 F
- Zero: 0 F
- Amounts that previously used formatCurrency: verify they still work

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
cd apps/mobile && pnpm run lint
```

**Expected Result**: Zero errors related to currency imports

### Level 2: Type Checking

```bash
cd apps/mobile && pnpm run type-check
```

**Expected Result**: No type errors related to missing modules

### Level 3: Unit Tests

```bash
cd apps/mobile && pnpm run test
```

**Expected Result**: All tests pass

### Level 4: Visual Verification

```bash
cd apps/mobile && npx expo start
```

**Expected Result**:

- App launches without errors
- Splash screen shows with `#F8FAFC` background
- Money amounts display as "X XXX F" format

### Level 5: Full Validation

```bash
cd apps/mobile && pnpm run validate
```

**Expected Result**: All lint and test steps pass

---

## ACCEPTANCE CRITERIA

**MANDATORY REQUIREMENTS - ALL MUST BE MET**:

- [ ] Legacy `currency.ts` file is deleted
- [ ] No broken imports exist in the codebase
- [ ] Splash screen backgroundColor is updated to `#F8FAFC`
- [ ] Android adaptive icon backgroundColor is updated to `#0F2A44` (optional but recommended)
- [ ] **ALL validation commands executed and pass with zero errors**
- [ ] Money formatting continues to work correctly (space separator, no decimals)
- [ ] App launches without errors
- [ ] Visual transition from splash to app is smooth and consistent

---

## COMPLETION CHECKLIST

**MANDATORY - EVERY ITEM MUST BE CHECKED BEFORE COMPLETION**:

- [ ] Task 1: Verified currency.ts is unused
- [ ] Task 2: Deleted currency.ts file
- [ ] Task 3: Verified no barrel export references
- [ ] Task 4: Updated splash backgroundColor to #F8FAFC
- [ ] Task 5: Updated Android adaptive icon backgroundColor to #0F2A44
- [ ] Task 6: Lint passes with no import errors
- [ ] Task 7: Type check passes
- [ ] Visual verification: splash screen displays correctly
- [ ] Visual verification: money amounts display correctly
- [ ] All acceptance criteria met

---

## EXTERNAL RESOURCES AND REFERENCES

### Official Documentation

- Expo App Configuration: https://docs.expo.dev/versions/latest/config/app/
- Expo Splash Screen: https://docs.expo.dev/versions/latest/sdk/splash-screen/
- React Native Safe Area: https://reactnavigation.org/docs/handling-safe-area/

### Internal Resources

- Theme colors: `apps/mobile/src/constants/theme-v2.ts`
- Money formatting: `apps/mobile/src/utils/money.ts`
- App configuration: `apps/mobile/app.config.ts`

---

## NOTES

**ParaThinker Analysis Results:**

- 8/8 strategy analyzers confirmed that `formatMoney()` in `money.ts` is ALREADY CORRECT
- 8/8 strategy analyzers confirmed that `currency.ts` is unused legacy code and should be removed
- 8/8 strategy analyzers confirmed that splash screen background color mismatch needs fixing
- 8/8 strategy analyzers confirmed that React Native does NOT have CSS hover effects (issue may be misunderstood)

**Color Decision Rationale:**

- Chose `#F8FAFC` (app background) over `#0F2A44` (primary dark) for splash because:
  - The splash image `full_icon.png` likely has a light background
  - Using app background color creates smooth transition
  - Alternative: If logo has dark theme variant, use `#0F2A44` instead

**Risk Assessment:**

- Currency change: Very Low (27/100) - deleting unused file
- Splash change: Low (32/100) - simple configuration update

**Important Reminders**:

- This plan contains ONLY functional specifications - NO code examples
- ALL tests must be written and passing before feature is considered complete
- ALL validation commands must execute successfully
- The `money.ts` file should NOT be modified - it's already correct

<!-- EOF -->
