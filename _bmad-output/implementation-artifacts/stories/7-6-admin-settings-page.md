# Story 7-6: Admin Settings Page

Status: backlog

## Story

**As a** Bubble Admin,
**I want** a dedicated settings page to configure system-level options,
**So that** I can manage LLM providers, system configuration, and platform settings through the UI.

## Background

The admin navigation previously included a Settings link that pointed to a non-existent route (404). The link was removed, but the functionality is still needed. Currently, LLM provider configuration is done via environment variables:

```
LLM_PROVIDER=mock|google-ai-studio|vertex
GOOGLE_AI_STUDIO_API_KEY=...
VERTEX_PROJECT_ID=...
```

This story creates the Settings page UI and backend to manage these configurations through the application.

## Acceptance Criteria

1. **Settings Page Route** - /admin/settings route exists and renders
2. **Navigation Link** - Settings link restored in admin sidebar
3. **LLM Provider Section** - View and configure LLM providers
4. **Provider Credentials** - Securely store/update API keys and credentials
5. **Model Management** - Add, edit, deactivate LLM models per provider
6. **Default Provider** - Set which provider is used by default for workflows
7. **Test Connection** - Button to test provider connectivity
8. **Audit Trail** - Log changes to settings for security
9. **Role Restriction** - Only bubble_admin can access settings

## Tasks

### Task 1: Create Settings Page Shell
- [ ] Create settings.component.ts with tabbed layout
- [ ] Add route /admin/settings
- [ ] Add Settings link back to admin sidebar
- [ ] Create settings section components (LLM, System, etc.)

### Task 2: LLM Provider Configuration Backend
- [ ] Create LlmProviderConfigEntity for storing provider settings
- [ ] Create LlmProviderConfigService with CRUD operations
- [ ] Create LlmProviderConfigController with endpoints:
  - GET /settings/llm-providers
  - POST /settings/llm-providers
  - PATCH /settings/llm-providers/:id
  - DELETE /settings/llm-providers/:id
  - POST /settings/llm-providers/:id/test

### Task 3: Secure Credential Storage
- [ ] Encrypt API keys before storing in database
- [ ] Never return full API keys in GET responses (mask all but last 4 chars)
- [ ] Allow updating credentials without viewing existing ones

### Task 4: LLM Provider UI Section
- [ ] List configured providers with status indicators
- [ ] Add provider form (type, name, credentials)
- [ ] Edit provider modal
- [ ] Test connection button with loading/success/error states
- [ ] Delete provider with confirmation

### Task 5: Model Management
- [ ] List available models per provider
- [ ] Add custom model to provider
- [ ] Enable/disable models
- [ ] Set default model

### Task 6: Tests
- [ ] Unit tests for LlmProviderConfigService
- [ ] Unit tests for credential encryption
- [ ] Unit tests for settings components
- [ ] E2E test for provider configuration flow

## Technical Notes

- Use AES-256 encryption for stored credentials with app-level encryption key
- Provider types: mock, google-ai-studio, vertex (extensible for future providers)
- Consider using a dedicated settings database table vs JSON config
- The existing LLM_PROVIDER env var becomes the fallback if no DB config exists

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Credentials properly encrypted
- [ ] All tests pass
- [ ] Lint passes
- [ ] Code review passed
- [ ] E2E test for settings flow

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #4 |
