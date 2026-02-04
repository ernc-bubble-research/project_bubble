# Story 7-7: UI Polish Pass

Status: backlog

## Story

**As a** User,
**I want** a polished, visually consistent interface,
**So that** the application feels professional and is pleasant to use.

## Background

During development, several UI components were built with functional focus. A dedicated polish pass is needed to:
- Improve visual consistency across all pages
- Fix spacing and alignment issues
- Enhance component styling
- Replace placeholder UI elements with final designs

This story is executed after all functional stories are complete (end of prototype phase).

## Scope

### Epic 1 Components
- [ ] Login page styling
- [ ] Set password page styling
- [ ] Admin dashboard cards
- [ ] Tenant list/detail pages
- [ ] User management UI
- [ ] Logout button → Replace with user avatar dropdown menu (all layouts)

### Epic 2 Components
- [ ] Data vault file browser
- [ ] Upload zone styling
- [ ] Folder tree UI

### Epic 3 Components
- [ ] Workflow wizard steps
- [ ] Template/chain cards
- [ ] Filter bar styling
- [ ] Search component
- [ ] Chain builder UI

### Epic 4-6 Components
- [ ] (To be added as those epics complete)

### Cross-Cutting
- [ ] Consistent button styles
- [ ] Consistent modal styles
- [ ] Consistent form input styles
- [ ] Loading states (spinners, skeletons)
- [ ] Error states
- [ ] Empty states
- [ ] Toast notification styling
- [ ] Responsive breakpoints

## Acceptance Criteria

1. **Visual Consistency** - All components follow the same design language
2. **Spacing** - Consistent padding/margins across all pages
3. **Typography** - Consistent font sizes and weights
4. **Colors** - Consistent use of CSS variables for theming
5. **Interactions** - Consistent hover/focus/active states
6. **Avatar Dropdown** - User avatar replaces logout button in all layouts
7. **No Regressions** - All existing functionality still works

## Tasks

### Task 1: Design Audit
- [ ] Document all UI inconsistencies
- [ ] Create checklist of items to fix
- [ ] Prioritize by visibility/impact

### Task 2: Global Styles
- [ ] Review and update CSS variables
- [ ] Create shared component styles
- [ ] Update typography scale

### Task 3: Component Updates
- [ ] Fix each component per audit checklist
- [ ] Test visual appearance
- [ ] Verify no functional regressions

### Task 4: User Avatar Dropdown
- [ ] Create avatar-dropdown.component.ts
- [ ] Replace logout button in admin-layout
- [ ] Replace logout button in app-layout
- [ ] Include: profile info, settings link, logout

### Task 5: Verification
- [ ] Visual review of all pages
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Responsive testing (desktop, tablet)

## Definition of Done

- [ ] All audit items addressed
- [ ] All tests pass
- [ ] Lint passes
- [ ] Code review passed
- [ ] Visual sign-off from stakeholder

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion items #1, #7 |
