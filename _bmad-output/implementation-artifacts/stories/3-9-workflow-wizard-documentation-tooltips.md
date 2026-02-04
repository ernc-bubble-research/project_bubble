# Story 3.9: Workflow Wizard Documentation & Tooltips

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** inline help and documentation for the workflow wizard,
**So that** I understand each step, field, and variable syntax without leaving the application.

## Background

The workflow wizard has complex concepts:
- Input roles (subject vs context)
- Variable syntax ({subject_name}, {timestamp}, etc.)
- Output formats (JSON schema, markdown sections)
- Prompt engineering best practices

Currently there is no documentation explaining these concepts. Users cannot effectively test or use the product.

## Acceptance Criteria

1. **Tooltips on All Fields** - Every form field has a tooltip explaining its purpose
2. **Variable Reference** - Inline reference showing available variables
3. **Input Role Explanation** - Clear explanation of subject vs context
4. **Prompt Help** - Tips for writing effective prompts
5. **Output Format Guide** - Examples for JSON schema and markdown sections
6. **Step Descriptions** - Each wizard step has a description header
7. **User Guide Document** - Standalone documentation file for reference

## Tooltips Required

### Basics Step
- [ ] Workflow Name - "A unique name for this workflow template"
- [ ] Description - "Explain what this workflow does and when to use it"

### Inputs Step
- [ ] Input Name - "Variable name used in prompts: {input_name}"
- [ ] Input Role - "Subject: the main document being analyzed. Context: supporting reference materials"
- [ ] Input Description - "Help users understand what to provide for this input"
- [ ] Required toggle - "If checked, workflow cannot run without this input"

### Prompt Step
- [ ] System Prompt - "Instructions that define the AI's behavior and expertise"
- [ ] User Prompt - "The specific task or question for the AI. Use {variable_name} for inputs"
- [ ] Variable picker - Show all available variables with copy button

### Output Step
- [ ] Output Type (JSON) - "Structured data with defined fields"
- [ ] Output Type (Markdown) - "Free-form text with optional sections"
- [ ] JSON Schema - "Define the structure of the AI's response"
- [ ] Markdown Sections - "Named sections the AI will fill in"

### Metadata Step
- [ ] Tags - "Categorize this workflow for filtering. Press comma or enter to add"
- [ ] Estimated Credits - "Approximate cost per execution"

## User Guide Content

Create `/docs/workflow-wizard-guide.md` with:

1. **Overview** - What is a workflow? What can it do?
2. **Input Roles**
   - Subject: Primary document(s) being analyzed
   - Context: Reference materials, guidelines, templates
3. **Variable Syntax**
   - `{input_name}` - Insert the content of an input
   - `{subject_name}` - Name of the subject file
   - `{timestamp}` - Current date/time
   - `{tenant_name}` - Name of the tenant running the workflow
4. **Prompt Engineering Tips**
   - Be specific about the task
   - Provide examples in context inputs
   - Use structured output for consistent results
5. **Output Formats**
   - JSON: When to use, schema examples
   - Markdown: When to use, section examples
6. **Best Practices**
   - Keep workflows atomic (single purpose)
   - Use chains for multi-step processes

## Tasks

### Task 1: Create Tooltip Component
- [ ] Create reusable `tooltip.component.ts`
- [ ] Support hover and click activation
- [ ] Position intelligently (avoid edge overflow)

### Task 2: Add Tooltips to Basics Step
- [ ] Add tooltips to name and description fields

### Task 3: Add Tooltips to Inputs Step
- [ ] Add tooltips to all input fields
- [ ] Add input role explanation panel

### Task 4: Add Tooltips to Prompt Step
- [ ] Add tooltips to system and user prompt
- [ ] Create variable picker component
- [ ] Show available variables based on defined inputs

### Task 5: Add Tooltips to Output Step
- [ ] Add tooltips to output type selection
- [ ] Add help text for JSON schema
- [ ] Add help text for markdown sections

### Task 6: Add Tooltips to Metadata Step
- [ ] Add tooltips to tags and credits fields

### Task 7: Add Step Descriptions
- [ ] Add description header to each wizard step
- [ ] Explain purpose of current step

### Task 8: Create User Guide
- [ ] Write comprehensive markdown guide
- [ ] Include examples and screenshots
- [ ] Place in /docs folder

### Task 9: Tests
- [ ] Unit tests for tooltip component
- [ ] Verify all tooltips render correctly

## Technical Notes

- Use a shared tooltip directive for consistency
- Consider adding a "Help" button that links to the full guide
- Tooltips should not block form interactions

## Definition of Done

- [ ] All tooltips implemented
- [ ] User guide document complete
- [ ] All tests pass
- [ ] Lint passes
- [ ] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #9 |
