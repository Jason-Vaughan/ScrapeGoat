# Chunk 8: AI Wizard (Mock) — Implementation Plan

## Context

Chunks 1–7 are complete. The wizard is the core template-building flow — a multi-step quiz where AI (mocked for now) analyzes extracted PDF text and generates options for the user to pick from. At the end, wizard answers are assembled into a `ProfileTemplate` that configures the parser engine. The user navigates to `/wizard` from the template selection page when choosing "Create New Template."

## File Structure

```
src/
  hooks/
    useWizardReducer.ts            # Wizard state types, reducer, custom hook
  services/
    mockAiService.ts               # Mock AI: analyzeDocument() + getCorrectionSuggestions()
    templateBuilder.ts             # Assemble wizard answers → ProfileTemplate
  components/wizard/
    WizardProgress.tsx             # Step X of 6 bar
    WizardNavBar.tsx               # Back / Skip / Next buttons
    WizardLoadingScreen.tsx        # Spinner + rotating tips
    WizardCancelDialog.tsx         # "Progress will be lost" confirmation
    DocumentStructureStep.tsx      # 3a: radio — block/table/list
    DateFormatStep.tsx             # 3b: radio — date format patterns
    TimezoneStep.tsx               # 3c: radio + searchable IANA list
    LocationsStep.tsx              # 3d: checkbox — locations
    StatusCodesStep.tsx            # 3e: checkbox — status codes
    EventNamesStep.tsx             # 3f: radio — name position
    ReviewTestStep.tsx             # 3g: test parse table with ✅/❌
    CorrectionStep.tsx             # 3h: flag issues → pick alternatives
    SaveTemplateStep.tsx           # 3i: name + save options
    FailurePage.tsx                # 3j: failure + bug report
  pages/
    WizardPage.tsx                 # Orchestrator (replaces placeholder)
```

Tests co-located: `*.test.ts(x)` alongside each file.

## Architecture Decisions

1. **Local useReducer, not AppContext** — wizard state is ephemeral. Only the final `ProfileTemplate` is dispatched to app state via `SET_TEMPLATE`.

2. **Mock service designed for swap** — `analyzeDocument()` and `getCorrectionSuggestions()` have the exact signatures the real Gemini service (Chunk 10) will use. Just replace the import.

3. **templateBuilder assembles answers → ProfileTemplate** — validates against Zod schema before returning. Called at review step (temporary test-parse) and save step (final).

4. **Correction cap: 3 rounds per event** — enforced in reducer. After 3 rounds, event auto-resolves with warning.

## Implementation Order

### Phase 1: Foundation
1. `useWizardReducer.ts` + tests — state machine backbone
2. `mockAiService.ts` + tests — data for all steps  
3. `templateBuilder.ts` + tests — needed for review step

### Phase 2: Shared UI
4. `WizardProgress.tsx`
5. `WizardNavBar.tsx`  
6. `WizardLoadingScreen.tsx`
7. `WizardCancelDialog.tsx`

### Phase 3: Quiz Steps (3a–3f)
8. `DocumentStructureStep.tsx` + test
9. `DateFormatStep.tsx` + test
10. `TimezoneStep.tsx` + test
11. `LocationsStep.tsx` + test
12. `StatusCodesStep.tsx` + test
13. `EventNamesStep.tsx` + test

### Phase 4: Post-Quiz Steps
14. `ReviewTestStep.tsx` + test
15. `CorrectionStep.tsx` + test
16. `SaveTemplateStep.tsx` + test
17. `FailurePage.tsx` + test

### Phase 5: Orchestration
18. Replace `WizardPage.tsx` with full orchestrator + integration test
19. Update CHANGELOG.md

## Key Types

```ts
type WizardStepId =
  | 'loading' | 'documentStructure' | 'dateFormat' | 'timezone'
  | 'locations' | 'statusCodes' | 'eventNames'
  | 'reviewTest' | 'correction' | 'saveTemplate' | 'failure'

interface WizardAnswers {
  documentStructure: string | null
  dateFormat: { pattern: string; format?: string } | null
  timezone: string | null
  locations: string[]
  statusCodes: string[]
  eventNamePosition: string | null
}

interface AiAnalysis { /* matches spec 4.4 response schema */ }
```

## Graceful Degradation (spec 3.3)

Three error states with distinct UI:
- `rate_limited`: "Template builder temporarily busy..." + note about saved templates still working
- `api_down`: "Template builder unavailable..." + same note
- `generic`: clear error + "what still works" messaging

Mock service accepts `__simulateError` param for testing these paths.

## Verification

1. `npm test` — all new tests pass (target: ~40+ new tests)
2. `npm run dev` — navigate full wizard flow with mock data: upload PDF → create template → quiz steps → review → save → results
3. Test cancel flow (back to template selection)
4. Test failure path (verify bug report UI)
5. Test skip on every step
6. Verify dark mode on all wizard screens
7. Verify mobile responsiveness

## Reusable Existing Code
- `parseText()` from `src/services/parser.ts` — used in ReviewTestStep for test parse
- `saveTemplate()`, `downloadTemplate()` from `src/services/templateStorage.ts` — used in SaveTemplateStep
- `templateSchema` from `src/schemas/templateSchema.ts` — validates built templates
- `TIMEZONES` array pattern from `src/pages/ExportPage.tsx` — reuse/expand for TimezoneStep
- Tailwind theme classes: `bg-surface`, `text-on-surface`, `text-primary`, `border-primary`, `bg-surface-dim`
