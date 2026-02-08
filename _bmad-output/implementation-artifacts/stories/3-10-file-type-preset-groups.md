# Story 3.10: File Type Preset Groups

Status: done

## Story

As a Bubble Admin,
I want to select common file type groups (Documents, Images, Spreadsheets, etc.) with one click when configuring file upload restrictions in the wizard,
so that I don't have to manually type dozens of individual file extensions.

## Background

The Workflow Builder Wizard Step 2 (Inputs) currently has a plain text input for allowed file extensions (`accept_extensions` form control). Users must manually type comma-separated extensions (e.g., `.pdf, .docx, .txt`). This is tedious and error-prone for common file type groups. This story replaces that text input with a chip-toggle UI backed by a shared constant, while preserving custom extension entry.

**Party Mode Pre-Dev Review (2026-02-08):** 5 findings incorporated — simplified UI (no pills), defined "All Files" semantics, single custom input replaces old text field, custom extensions survive preset toggles, new shared constants directory.

## Acceptance Criteria

1. **Preset Constant** — A shared constant `FILE_TYPE_PRESETS` is defined in `libs/shared/src/lib/constants/file-type-presets.ts` and exported via barrel exports. Each preset has `key`, `label`, `hint` (short extension preview), and `extensions` array.
2. **Chip Row** — When a file source (asset or upload) is selected for an input, a row of toggleable preset chips replaces the old comma-separated text input. 7 presets: Documents, Spreadsheets, Images, Audio/Video, Archives, Code, All Files.
3. **Chip Toggle** — Clicking a preset chip toggles it on/off. Toggling ON adds its extensions to the accepted list. Toggling OFF removes only its extensions (custom extensions survive).
4. **All Files Chip** — Selecting "All Files" clears all other presets and sets `extensions` to an empty array (meaning no restriction). Selecting any other preset while "All Files" is active deselects "All Files".
5. **Custom Extension Input** — A small input below the chips allows adding custom extensions (e.g., `.custom`). Pressing Enter or comma adds the extension. Custom extensions are visually distinct from preset extensions.
6. **Extension Display** — Selected chip labels include a short hint of their extensions (e.g., "Documents (.pdf, .docx, ...)"). No separate pills row.
7. **Data Model Unchanged** — The `WorkflowAcceptConfig.extensions: string[]` interface is NOT modified. The chip UI is purely a frontend convenience that populates the same `extensions` array.

## Tasks / Subtasks

- [x] Task 1: Create shared constant and barrel export (AC: 1)
  - [x] 1.1: Create `libs/shared/src/lib/constants/file-type-presets.ts` with `FILE_TYPE_PRESETS` array
  - [x] 1.2: Create `libs/shared/src/lib/constants/index.ts` barrel export
  - [x] 1.3: Add `export * from './lib/constants'` to `libs/shared/src/index.ts`
  - [x] 1.4: Unit test for preset constant shape (non-empty, valid extensions, no duplicates across groups)

- [x] Task 2: Update wizard inputs step with chip UI (AC: 2, 3, 4, 5, 6, 7)
  - [x] 2.1: Import `FILE_TYPE_PRESETS` in `wizard-inputs-step.component.ts`
  - [x] 2.2: Add methods: `togglePreset(index, key)`, `addCustomExtension(index, ext)`, `removeCustomExtension(index, ext)`, `isPresetActive(index, key)`, `getCustomExtensions(index)`
  - [x] 2.3: Replace `accept_extensions` text input in HTML with chip row + custom extension input
  - [x] 2.4: Add `.preset-chips`, `.preset-chip`, `.preset-chip.active`, `.custom-ext-tags`, `.custom-ext-tag` styles to `wizard-step-shared.scss`
  - [x] 2.5: Update `syncToParent()` to build `extensions[]` from active presets + custom extensions
  - [x] 2.6: Update `createInputGroup()` to reverse-map existing `extensions[]` back to active presets on form init
  - [x] 2.7: Add `data-testid` attributes: `preset-chip-{key}-{i}`, `custom-ext-input-{i}`, `custom-ext-tag-{ext}-{i}`, `preset-chips-{i}`, `custom-ext-tags-{i}`
  - [x] 2.8: Unit tests for chip toggle, All Files behavior, custom extension add/remove, preset survival

## Dev Notes

### Existing Code to Modify

| File | What Changes |
|------|-------------|
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step.component.ts` | Import presets, add toggle/custom methods, update syncToParent + createInputGroup |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step.component.html` | Replace extension text input with chip row + custom input + tooltips |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-step-shared.scss` | Add preset chip + custom extension styles |
| `libs/shared/src/index.ts` | Add `export * from './lib/constants'` barrel re-export |

### New Files

| File | Description |
|------|-------------|
| `libs/shared/src/lib/constants/file-type-presets.ts` | `FILE_TYPE_PRESETS` constant array + `FileTypePreset` interface |
| `libs/shared/src/lib/constants/index.ts` | Barrel export for constants directory |
| `libs/shared/src/lib/constants/file-type-presets.spec.ts` | 5 unit tests for preset constant shape |
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step-presets.spec.ts` | 14 unit tests for preset chip UI behavior |

### Architecture & Pattern Notes

- **Data model is UNCHANGED**: `WorkflowAcceptConfig.extensions?: string[]` in `libs/shared/src/lib/types/workflow-definition.interface.ts` stays exactly as-is. The chips are purely a UI layer.
- **Form control change**: The `accept_extensions` form control currently stores a comma-separated string. It needs to change to store a `string[]` array internally (or be supplemented with a derived signal). The `syncToParent()` method at line 150 already converts to `string[]` — the reverse mapping in `createInputGroup()` at line 87 (`.join(', ')`) needs to parse back to identify which presets are active.
- **Reverse mapping strategy**: On form init, iterate `FILE_TYPE_PRESETS` and check if ALL extensions of a preset are present in the input's existing `extensions[]`. If yes, mark that preset as active. Remaining extensions not covered by any preset are "custom".
- **"All Files" semantics**: Empty `extensions[]` = no restriction. When "All Files" is active, `accept.extensions` is omitted entirely from the output (same as today when the field is blank). Rationale: the backend has no validation yet (Epic 4), so omitting extensions means "accept anything."
- **Existing chip styles**: `wizard-step-shared.scss` already has `.chip`, `.chip-neutral`, `.chips-list` classes (lines 277-311). The preset chips should reuse and extend these.
- **Existing spec**: `wizard-inputs-step.component.spec.ts` has 9 tests (3.2-UNIT-012 through 3.2-UNIT-020). New tests should use IDs `3.10-UNIT-001` through `3.10-UNIT-00X`.

### FILE_TYPE_PRESETS Constant Shape

```typescript
export interface FileTypePreset {
  key: string;       // e.g., 'documents'
  label: string;     // e.g., 'Documents'
  hint: string;      // e.g., '.pdf, .docx, ...'
  extensions: string[];  // e.g., ['.pdf', '.doc', '.docx', '.rtf', '.txt', '.odt']
}

export const FILE_TYPE_PRESETS: FileTypePreset[] = [
  { key: 'documents', label: 'Documents', hint: '.pdf, .docx, ...', extensions: ['.pdf', '.doc', '.docx', '.rtf', '.txt', '.odt'] },
  { key: 'spreadsheets', label: 'Spreadsheets', hint: '.xlsx, .csv, ...', extensions: ['.xls', '.xlsx', '.csv', '.tsv', '.ods'] },
  { key: 'images', label: 'Images', hint: '.jpg, .png, ...', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'] },
  { key: 'audio-video', label: 'Audio/Video', hint: '.mp3, .mp4, ...', extensions: ['.mp3', '.wav', '.mp4', '.avi', '.mov', '.webm'] },
  { key: 'archives', label: 'Archives', hint: '.zip, .tar, ...', extensions: ['.zip', '.tar', '.gz', '.7z', '.rar'] },
  { key: 'code', label: 'Code', hint: '.js, .py, ...', extensions: ['.js', '.ts', '.py', '.java', '.json', '.xml', '.yaml', '.html', '.css'] },
  { key: 'all', label: 'All Files', hint: 'No restriction', extensions: [] },
];
```

### Key Design Decisions

1. **No duplicate extension text input** — The old comma-separated `<input>` is fully replaced by chips + custom input. Rationale: having both creates confusion about which is authoritative.
2. **No "read-only pills" below chips** — The chip label itself includes a hint (e.g., "Documents (.pdf, .docx, ...)"). Rationale: a second representation of the same data adds UI complexity for no user value.
3. **Custom extensions survive preset toggles** — Toggling a preset on/off only adds/removes that preset's specific extensions. Any extension not belonging to a preset is considered "custom" and is never affected by preset toggles. Rationale: prevents data loss.
4. **Extensions use dot prefix** — All extensions stored with leading dot (`.pdf` not `pdf`). This matches existing wizard behavior (placeholder says `.pdf, .docx, .txt`).

### References

- [Source: libs/shared/src/lib/types/workflow-definition.interface.ts] — WorkflowAcceptConfig interface
- [Source: apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step.component.ts] — Current form control and syncToParent logic
- [Source: apps/web/src/app/admin/workflows/wizard/steps/wizard-inputs-step.component.html:155-179] — Current extension text input
- [Source: apps/web/src/app/admin/workflows/wizard/steps/wizard-step-shared.scss:277-311] — Existing chip styles
- [Source: _bmad-output/planning-artifacts/epics.md:489-503] — Epic-level story definition + party mode consensus

## Test Traceability

| AC | Test ID | Test File | Test Description | Status |
|----|---------|-----------|------------------|--------|
| AC1 | 3.10-UNIT-001 | file-type-presets.spec.ts | Preset constant has 7 groups | PASS |
| AC1 | 3.10-UNIT-001a | file-type-presets.spec.ts | All extensions have dot prefix | PASS |
| AC1 | 3.10-UNIT-001b | file-type-presets.spec.ts | No duplicate extensions across groups | PASS |
| AC1 | 3.10-UNIT-001c | file-type-presets.spec.ts | Required properties on every preset | PASS |
| AC1 | 3.10-UNIT-001d | file-type-presets.spec.ts | "all" preset has empty extensions | PASS |
| AC2 | 3.10-UNIT-002 | wizard-inputs-step-presets.spec.ts | Presets array exposed with 7 groups | PASS |
| AC3 | 3.10-UNIT-003 | wizard-inputs-step-presets.spec.ts | Toggle preset ON adds extensions | PASS |
| AC3 | 3.10-UNIT-003a | wizard-inputs-step-presets.spec.ts | Toggle preset OFF removes only its extensions | PASS |
| AC4 | 3.10-UNIT-004 | wizard-inputs-step-presets.spec.ts | All Files clears other presets + custom extensions | PASS |
| AC4 | 3.10-UNIT-004a | wizard-inputs-step-presets.spec.ts | Selecting preset deselects All Files | PASS |
| AC5 | 3.10-UNIT-005 | wizard-inputs-step-presets.spec.ts | Custom extension added via input | PASS |
| AC5 | 3.10-UNIT-005a | wizard-inputs-step-presets.spec.ts | Custom extension removed | PASS |
| AC5 | 3.10-UNIT-005b | wizard-inputs-step-presets.spec.ts | Custom extensions survive preset toggle | PASS |
| AC5 | 3.10-UNIT-008 | wizard-inputs-step-presets.spec.ts | Trailing commas stripped from custom extension input | PASS |
| AC6 | 3.10-UNIT-006 | wizard-inputs-step-presets.spec.ts | Existing extensions reverse-map to active presets on init | PASS |
| AC7 | 3.10-UNIT-007 | wizard-inputs-step-presets.spec.ts | syncToParent produces correct extensions array | PASS |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Completion Notes List
- Created `libs/shared/src/lib/constants/` directory with `file-type-presets.ts` (interface + constant) and `index.ts` barrel
- Added `export * from './lib/constants'` to shared lib index
- Removed `accept_extensions` form control — replaced with signal-based `inputPresetState` tracking active presets and custom extensions per input
- Added `togglePreset`, `addCustomExtension`, `removeCustomExtension`, `isPresetActive`, `getCustomExtensions` methods
- Updated `createInputGroup()` with reverse-mapping logic (checks if ALL extensions of a preset are present)
- Updated `syncToParent()` to build extensions from active presets + custom extensions
- Replaced HTML text input with chip row (`preset-chips`) + custom extension tags + custom input with Enter/comma handlers
- Added SCSS styles for `.preset-chips`, `.preset-chip`, `.preset-chip.active`, `.custom-ext-tags`, `.custom-ext-tag`
- Created separate spec file `wizard-inputs-step-presets.spec.ts` (14 tests) to stay under 300-line spec limit
- 5 shared constant tests + 14 component preset tests = 19 new tests
- Code review: 6 findings fixed (2 missing tooltips, comma normalization bug, trailing-comma test, 2 missing test IDs, story table inaccuracies)

### Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-08 | SM Agent | Story created from Epic 3 discussion item (UX-1). Party mode pre-dev review: 5 findings incorporated. |
| 2026-02-08 | Dev Agent (Opus 4.6) | Implementation complete. 2 tasks, 12 subtasks all done. 18 new tests (5 shared + 13 component). 918 total tests, 0 lint errors. |
| 2026-02-08 | Code Review (Opus 4.6) | 7 findings (0H/3M/4L). 6 fixed: 2 missing tooltips (Rule 17), comma normalization bug, trailing-comma test, 2 missing test IDs, story table inaccuracies. 1 noted (performance acceptable at scale). |
