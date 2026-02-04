# Story 3.7: Workflow Studio Template Library (Admin UI)

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** a template library view in Workflow Studio showing all workflow templates and chains,
**So that** I can browse, search, filter, and manage my workflow catalog.

## Acceptance Criteria

1. **Navigation**: Accessible at `/admin/workflow-studio`
2. **Card Grid Layout**: Display workflow templates as a card grid with responsive columns
3. **Template Card Content**: Each card shows: name, description, tags, status badge (draft/published), visibility badge (public/private), version number, last modified date
4. **Status Filtering**: Filter by status (All, Published, Draft, Archived)
5. **Visibility Filtering**: Filter by visibility (All, Public, Private)
6. **Tag Filtering**: Filter by tags (multi-select)
7. **Search**: Search by name and description (debounced input)
8. **Click to Edit**: Clicking a template card opens the edit wizard (Story 3.2)
9. **Create Workflow**: "Create Workflow" button starts the wizard for a new template
10. **Chains Tab/Section**: Separate tab or section shows workflow chains with similar card layout
11. **Duplicate Template**: Action to duplicate an existing template to create a new one
12. **Test IDs**: All interactive elements have `data-testid` attributes

## Pre-Implementation Context

### Already Implemented

The following components and services already exist:

- **WorkflowWizardComponent** (`apps/web/src/app/admin/workflows/wizard/`) - Edit wizard for templates
- **WorkflowTemplateService** (`apps/web/src/app/core/services/workflow-template.service.ts`) - HTTP service for templates API
- **WorkflowChainService** (Story 3.6b) - HTTP service for chains API
- **ToastService** - Notifications

### API Endpoints Available

Templates (from Epic 3 Stories):
- `GET /admin/workflow-templates` - List templates with pagination, status filter
- `GET /admin/workflow-templates/:id` - Get template by ID
- `POST /admin/workflow-templates` - Create template
- `DELETE /admin/workflow-templates/:id` - Soft-delete template

Chains (from Story 3.6a):
- `GET /admin/workflow-chains` - List chains with pagination
- `GET /admin/workflow-chains/:id` - Get chain by ID

### UX Design Reference

From `ux-design-specification.md` §4.10:
- Card grid with `auto-fill, minmax(280px, 1fr)`
- Cards: `--bg-surface`, `--radius-xl`, 24px padding
- Status badges: PUBLISHED (green), DRAFT (amber), ARCHIVED (slate)
- Filter tabs with count badges
- "Recently Edited" activity feed (optional)

### Patterns to Follow

From `project-context.md`:
- Rule 6: Standalone components with `inject()` for DI
- Rule 7: Custom design system (no Material/PrimeNG) — use CSS variables
- Rule 9: Services return Observables
- Rule 10: `data-testid` on all interactive elements

## Tasks / Subtasks

### Task 1: Create Workflow Studio Container Component (AC: 1)
- [ ] Create/update `workflow-studio.component.ts` in `apps/web/src/app/admin/workflows/`
- [ ] Implement page layout with header, filters, and content area
- [ ] Add tab navigation between "Templates" and "Chains" views
- [ ] Wire up to route `/admin/workflow-studio`
- [ ] Add `data-testid`: `workflow-studio-container`, `workflow-studio-templates-tab`, `workflow-studio-chains-tab`

### Task 2: Create Template Card Component (AC: 2, 3)
- [ ] Create `template-card.component.ts` in `apps/web/src/app/admin/workflows/`
- [ ] Display template info:
  - Name (16px, 700 weight, truncate if long)
  - Description (13px, `--text-secondary`, 2-line clamp)
  - Tags (pill badges, max 3 visible + "+N more")
  - Status badge (PUBLISHED/DRAFT/ARCHIVED with appropriate colors)
  - Visibility badge (PUBLIC/PRIVATE)
  - Version number (e.g., "v3")
  - Last modified date (relative format: "2h ago", "3 days ago")
- [ ] Card styling: `--bg-surface`, `--radius-xl`, 24px padding
- [ ] Hover effect: subtle lift + `--shadow-md`
- [ ] Add `data-testid`: `template-card-{id}`

### Task 3: Create Chain Card Component (AC: 10)
- [ ] Create `chain-card.component.ts` in `apps/web/src/app/admin/workflows/`
- [ ] Display chain info:
  - Name
  - Description
  - Step count (e.g., "3 steps")
  - Status badge (DRAFT/PUBLISHED)
  - Visibility badge
  - Last modified date
- [ ] Same styling as template cards for consistency
- [ ] Add `data-testid`: `chain-card-{id}`

### Task 4: Create Filter Bar Component (AC: 4, 5, 6)
- [ ] Create `workflow-filter-bar.component.ts`
- [ ] Status filter tabs: All | Published | Draft | Archived
  - Each tab shows count badge
  - Active tab has `--primary-600` underline
- [ ] Visibility dropdown filter: All | Public | Private
- [ ] Tags multi-select filter (fetch available tags from templates)
- [ ] Clear filters button when any filter is active
- [ ] Emit filter changes as output signal
- [ ] Add `data-testid`: `filter-status-all`, `filter-status-published`, `filter-status-draft`, `filter-status-archived`, `filter-visibility`, `filter-tags`

### Task 5: Create Search Component (AC: 7)
- [ ] Create `workflow-search.component.ts` or add to filter bar
- [ ] Debounced search input (300ms delay)
- [ ] Search icon (lucide `search`)
- [ ] Clear button when search has value
- [ ] Emit search term as output signal
- [ ] Add `data-testid`: `workflow-search-input`

### Task 6: Implement Template List View (AC: 8, 9)
- [ ] Create `template-list.component.ts`
- [ ] Fetch templates using WorkflowTemplateService
- [ ] Apply filters (status, visibility, tags, search)
- [ ] Responsive grid layout: `auto-fill, minmax(280px, 1fr)`
- [ ] On card click: navigate to `/admin/workflow-studio/:id/edit`
- [ ] "+ Create Workflow" button in header
  - On click: navigate to `/admin/workflow-studio/new/edit`
- [ ] Empty state: "No workflows yet. Click '+ Create Workflow' to build your first template."
- [ ] Loading state with skeleton cards
- [ ] Add `data-testid`: `template-list`, `create-workflow-button`

### Task 7: Implement Chain List View (AC: 10)
- [ ] Create `chain-list.component.ts`
- [ ] Fetch chains using WorkflowChainService
- [ ] Same filtering pattern as templates (status, visibility, search)
- [ ] Responsive grid layout matching templates
- [ ] On card click: navigate to `/admin/workflow-studio/chains/:id/edit`
- [ ] "+ Create Chain" button
  - On click: navigate to `/admin/workflow-studio/chains/new`
- [ ] Empty state: "No chains yet. Click '+ Create Chain' to build your first workflow chain."
- [ ] Add `data-testid`: `chain-list`, `create-chain-button`

### Task 8: Implement Duplicate Template Feature (AC: 11)
- [ ] Add "Duplicate" action to template card (via dropdown menu or hover action)
- [ ] On duplicate:
  1. Fetch full template with current version
  2. Create new template with name: "{original name} (Copy)"
  3. Create initial version with same definition
  4. Navigate to edit wizard for new template
- [ ] Show toast on success/error
- [ ] Add `data-testid`: `template-card-{id}-duplicate`

### Task 9: Wire Up Navigation
- [ ] Ensure route `/admin/workflow-studio` exists and loads WorkflowStudioComponent
- [ ] Link from admin sidebar/nav to Workflow Studio
- [ ] Breadcrumb: "Admin / Workflow Studio"

### Task 10: Unit Tests
- [ ] Create `workflow-studio.component.spec.ts`
  - [3.7-UNIT-001] Test renders templates tab by default
  - [3.7-UNIT-002] Test switches to chains tab
- [ ] Create `template-card.component.spec.ts`
  - [3.7-UNIT-003] Test displays template name and description
  - [3.7-UNIT-004] Test shows correct status badge
  - [3.7-UNIT-005] Test shows visibility badge
  - [3.7-UNIT-006] Test emits click event
- [ ] Create `chain-card.component.spec.ts`
  - [3.7-UNIT-007] Test displays chain info
  - [3.7-UNIT-008] Test shows step count
- [ ] Create `workflow-filter-bar.component.spec.ts`
  - [3.7-UNIT-009] Test status filter tabs work
  - [3.7-UNIT-010] Test visibility filter emits changes
  - [3.7-UNIT-011] Test tags filter works
- [ ] Create `workflow-search.component.spec.ts`
  - [3.7-UNIT-012] Test debounces search input
  - [3.7-UNIT-013] Test clear button works
- [ ] Create `template-list.component.spec.ts`
  - [3.7-UNIT-014] Test fetches and displays templates
  - [3.7-UNIT-015] Test applies filters
  - [3.7-UNIT-016] Test navigates on card click
  - [3.7-UNIT-017] Test create button navigates
- [ ] Create `chain-list.component.spec.ts`
  - [3.7-UNIT-018] Test fetches and displays chains
  - [3.7-UNIT-019] Test navigates to chain builder

## Dev Notes

### Architecture Patterns

- **Standalone Components**: All components `standalone: true` with `inject()` for DI
- **Signal-Based State**: Use signals for filter state, search term, loading state
- **Observable HTTP**: Services return `Observable<T>`
- **Custom Styling**: Use CSS variables from `styles.scss`
- **Responsive Grid**: CSS Grid with `auto-fill, minmax(280px, 1fr)`

### Component Tree

```
WorkflowStudioComponent (container)
├── WorkflowFilterBarComponent
│   └── WorkflowSearchComponent (embedded or separate)
├── TemplateListComponent (when Templates tab active)
│   └── (per template) TemplateCardComponent
└── ChainListComponent (when Chains tab active)
    └── (per chain) ChainCardComponent
```

### Filter State Model

```typescript
interface WorkflowFilters {
  status: 'all' | 'published' | 'draft' | 'archived';
  visibility: 'all' | 'public' | 'private';
  tags: string[];
  search: string;
}
```

### Card Layout CSS

```scss
.workflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
  padding: 24px;
}

.workflow-card {
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  padding: 24px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}
```

### Status Badge Colors

```scss
.status-badge {
  &.published { background: var(--success-bg); color: var(--success-text); }
  &.draft { background: var(--warning-bg); color: var(--warning-text); }
  &.archived { background: var(--slate-100); color: var(--slate-600); }
}
```

### API Query Parameters

Templates:
```typescript
// GET /admin/workflow-templates
interface ListTemplatesQuery {
  limit?: number;      // default 20
  offset?: number;     // default 0
  status?: string;     // 'published' | 'draft' | 'archived'
  visibility?: string; // 'public' | 'private'
  search?: string;     // search in name/description
}
```

Chains:
```typescript
// GET /admin/workflow-chains
interface ListChainsQuery {
  limit?: number;
  offset?: number;
  status?: string;
  visibility?: string;
}
```

### References

- [UX Design Specification §4.10](../../_bmad-output/planning-artifacts/ux-design-specification.md) - Template Library design
- [WorkflowTemplateService](../../apps/web/src/app/core/services/workflow-template.service.ts) - HTTP service
- [WorkflowWizardComponent](../../apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts) - Edit wizard
- [Project Context](../../project-context.md) - Rules 6, 7, 9, 10
- [Story 3.6b](./3-6b-workflow-chain-builder-ui.md) - Chain builder reference

## Test IDs

Use these test ID prefixes for unit tests:
- `[3.7-UNIT-001]` through `[3.7-UNIT-019]` for unit tests

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Unit tests passing (target: 19+ tests)
- [ ] No lint errors (`nx lint web`)
- [ ] Build succeeds (`nx build web`)
- [ ] All interactive elements have `data-testid` attributes
- [ ] Code review passed

---

## File List

### Files to Create
| File | Purpose |
|------|---------|
| `apps/web/src/app/admin/workflows/workflow-studio.component.ts` | Container component (may already exist, update if so) |
| `apps/web/src/app/admin/workflows/workflow-studio.component.html` | Container template |
| `apps/web/src/app/admin/workflows/workflow-studio.component.scss` | Container styles |
| `apps/web/src/app/admin/workflows/workflow-studio.component.spec.ts` | Container tests |
| `apps/web/src/app/admin/workflows/template-card.component.ts` | Template card |
| `apps/web/src/app/admin/workflows/template-card.component.spec.ts` | Template card tests |
| `apps/web/src/app/admin/workflows/chain-card.component.ts` | Chain card |
| `apps/web/src/app/admin/workflows/chain-card.component.spec.ts` | Chain card tests |
| `apps/web/src/app/admin/workflows/workflow-filter-bar.component.ts` | Filter bar |
| `apps/web/src/app/admin/workflows/workflow-filter-bar.component.spec.ts` | Filter bar tests |
| `apps/web/src/app/admin/workflows/workflow-search.component.ts` | Search input |
| `apps/web/src/app/admin/workflows/workflow-search.component.spec.ts` | Search tests |
| `apps/web/src/app/admin/workflows/template-list.component.ts` | Template grid |
| `apps/web/src/app/admin/workflows/template-list.component.spec.ts` | Template list tests |
| `apps/web/src/app/admin/workflows/chain-list.component.ts` | Chain grid |
| `apps/web/src/app/admin/workflows/chain-list.component.spec.ts` | Chain list tests |

### Files to Modify
| File | Changes |
|------|---------|
| `apps/web/src/app/app.routes.ts` | Ensure workflow-studio route exists |
| `apps/web/src/app/admin/admin-layout.component.ts` | Add sidebar link to Workflow Studio (if not present) |

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Story Creation | Initial story creation from Epic 3.7 requirements |
