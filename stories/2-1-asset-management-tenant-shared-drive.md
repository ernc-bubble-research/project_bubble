# Story 2.1: Asset Management (Tenant Shared Drive)

Status: done

## Story

As a **Customer Admin or Creator**,
I want to upload and manage files in a shared Data Vault,
so that my team has a central repository of inputs for workflow execution.

## Acceptance Criteria

1. **AC1 — File Upload**: Given I upload a file (Text/PDF only for MVP), then it is stored in the tenant's Data Vault, accessible to all tenant users. The system supports parallel uploads (multiple files simultaneously).
2. **AC2 — Folder Organization**: Given I am in the Data Vault, I can create, rename, and delete folders. Files can be moved between folders. Nested folders are supported. A root "All Files" view shows everything.
3. **AC3 — Duplicate Detection**: Given I upload a file, the system calculates a SHA-256 hash. If a file with the same hash already exists in the tenant, the upload is rejected with a warning "File already exists".
4. **AC4 — Soft Delete / Archive**: Given I delete a file, it is moved to "archived" status (soft delete). Archived files are recoverable for N days (configured per tenant via `assetRetentionDays`). A warning confirms deletion affects all tenant users.
5. **AC5 — File Metadata**: Each file stores: original filename, MIME type, file size, SHA-256 hash, `isIndexed` boolean (default false — set to true when user adds file to Knowledge Base in Story 2.2), folder assignment, upload user ID, and timestamps. Files are type-agnostic — no asset type tagging at upload time.
6. **AC6 — API Endpoints**: REST API provides CRUD for assets and folders under `/api/app/assets` and `/api/app/folders`. All endpoints enforce JWT auth and RLS tenant isolation via `TransactionManager`.
7. **AC7 — Data Vault UI**: Angular Data Vault page at `/app/data-vault` with: folder tree sidebar, file grid/list toggle, drag-and-drop upload zone, file type filter chips, and bulk select actions.
8. **AC8 — File Validation**: Uploads reject files with disallowed extensions (only `.pdf`, `.txt`, `.md`, `.docx` allowed). Max file size: 10MB. MIME type is validated server-side.
9. **AC9 — Log Sanitization**: All logging in the asset module sanitizes file content — no PII or document text appears in logs. Only metadata (filename, size, hash) is logged.
10. **AC10 — Tests Pass**: All new and existing tests pass. New unit tests cover: asset service CRUD, folder service CRUD, file validation, duplicate detection, soft delete, and controller endpoints.

## Tasks / Subtasks

- [x] **Task 1: Database Entities & DTOs** (AC: 1, 2, 5)
  - [x] 1.1: Create `AssetEntity` in `libs/db-layer/src/lib/entities/asset.entity.ts` with columns: `id` (uuid PK), `tenantId` (uuid, for RLS), `folderId` (uuid nullable FK with `@ManyToOne` + `onDelete: 'SET NULL'`), `originalName` (string), `storagePath` (string), `mimeType` (string), `fileSize` (integer), `sha256Hash` (string, `@Column({ length: 64 })`), `isIndexed` (boolean, default false — tracks Knowledge Base indexing status), `status` (enum: active, archived), `archivedAt` (nullable Date), `uploadedBy` (plain uuid column — NOT a TypeORM `@ManyToOne` relation, matching `tenantId` pattern), `createdAt`, `updatedAt`. Export from `entities/index.ts`. **Note:** `assetType` enum was removed — files are type-agnostic (see Epic 2 Design Decision).
  - [x] 1.2: Create `FolderEntity` in `libs/db-layer/src/lib/entities/folder.entity.ts` with columns: `id` (uuid PK), `tenantId` (uuid, for RLS), `name` (string), `parentId` (uuid nullable self-FK for nesting), `createdAt`, `updatedAt`. Export from `entities/index.ts`.
  - [x] 1.3: Add RLS policies for `assets` and `folders` tables in `RlsSetupService` — add `'assets', 'folders'` to the `tenantScopedTables` array. Only the standard tenant isolation policy is needed (no auth bypass policies — unlike users/invitations, assets and folders are only accessed post-authentication).
  - [x] 1.4: Create DTOs in `libs/shared/src/lib/dtos/asset/`: `UploadAssetDto` (folderId optional), `UpdateAssetDto` (name, folderId — all optional), `AssetResponseDto` (includes `isIndexed` boolean), `CreateFolderDto` (name, parentId optional), `UpdateFolderDto` (name), `FolderResponseDto`. Add `@ApiProperty` decorators and `class-validator` decorators. Export from `libs/shared/src/lib/dtos/index.ts`. **Note:** `assetType`/`AssetTypeDto` removed from all DTOs.

- [x] **Task 2: Asset Storage Backend** (AC: 1, 3, 8, 9)
  - [x] 2.1: Create `apps/api-gateway/src/app/assets/assets.module.ts` — imports `TypeOrmModule.forFeature([AssetEntity, FolderEntity])`, registers controllers and services.
  - [x] 2.2: Create `apps/api-gateway/src/app/assets/assets.service.ts` — uses `TransactionManager` for all DB operations. Methods: `upload(file, dto, tenantId, userId)`, `findAll(tenantId, folderId?)`, `findOne(id, tenantId)`, `update(id, tenantId, dto)`, `archive(id, tenantId)`, `restore(id, tenantId)`. SHA-256 hash computed on upload, duplicate check before save. **Note:** `assetType` filter removed from `findAll` — files are type-agnostic.
  - [x] 2.3: Create `apps/api-gateway/src/app/assets/folders.service.ts` — uses `TransactionManager`. Methods: `create(dto, tenantId)`, `findAll(tenantId)`, `update(id, tenantId, dto)`, `delete(id, tenantId)` (reject if folder has files).
  - [x] 2.4: File storage: use Multer's default memory storage. In the service, write files manually using `fs/promises.writeFile()` to `uploads/{tenantId}/{uuid}-{originalName}` on local disk (MVP). This keeps storage logic in the service layer for easier migration to S3 later. Store the relative `storagePath` in DB. Create `uploads/` directory if not exists. Add `uploads/` to `.gitignore`.
  - [x] 2.5: File validation in the service (not middleware): check extension whitelist (`.pdf`, `.txt`, `.md`, `.docx`), max size 10MB, validate MIME type server-side against explicit whitelist: `application/pdf`, `text/plain`, `text/markdown`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Reject with 400 Bad Request and clear error message.
  - [x] 2.6: Sanitize all logger calls — log only `{ id, filename, size, hash, tenantId }`, never file content.

- [x] **Task 3: REST API Controllers** (AC: 6, 8)
  - [x] 3.1: Create `apps/api-gateway/src/app/assets/assets.controller.ts` — routes under `/api/app/assets`. Use `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)` (include BUBBLE_ADMIN for impersonation access). Use `@UseInterceptors(FileInterceptor('file'))` for upload endpoint. Endpoints: `POST /` (upload), `GET /` (list with query params: folderId, assetType), `GET /:id` (single), `PATCH /:id` (update metadata), `DELETE /:id` (archive), `POST /:id/restore` (restore from archive). Add `@ApiTags('Assets')`, `@ApiBearerAuth()`, `@ApiOperation()` decorators.
  - [x] 3.2: Create `apps/api-gateway/src/app/assets/folders.controller.ts` — routes under `/api/app/folders`. Same guards (include `BUBBLE_ADMIN`, `CUSTOMER_ADMIN`, `CREATOR`). Endpoints: `POST /` (create), `GET /` (list tree), `PATCH /:id` (rename), `DELETE /:id` (delete empty folder). Add Swagger decorators.
  - [x] 3.3: Register `AssetsModule` in `app.module.ts`.

- [x] **Task 4: Angular Data Vault UI** (AC: 7, 2)
  - [x] 4.1: Create `apps/web/src/app/core/services/asset.service.ts` — HttpClient wrapper for all asset and folder API endpoints. Use `inject()` pattern.
  - [x] 4.2: Create app layout component `apps/web/src/app/app-shell/app-layout.component.ts` — sidebar navigation for Zone B (`/app/*`) with links: Data Vault, Workflows (coming soon). Same dark sidebar pattern as admin layout.
  - [x] 4.3: Create `apps/web/src/app/app/data-vault/data-vault.component.ts` — main page with: folder tree sidebar (left), file grid (main area), grid/list view toggle, search input. **Note:** Asset type filter chips removed — files are type-agnostic. Future: "Indexed" filter chip may be added when Story 2.2 implements Knowledge Base indexing.
  - [x] 4.4: Create `apps/web/src/app/app/data-vault/upload-zone.component.ts` — drag-and-drop file upload zone. Shows accepted types and max size. Supports multi-file selection. Shows upload progress per file. Calls `assetService.upload()` for each file.
  - [x] 4.5: Create `apps/web/src/app/app/data-vault/folder-tree.component.ts` — collapsible folder tree with: create folder button, right-click or action menu (rename, delete), folder selection highlights active folder.
  - [x] 4.6: Create `apps/web/src/app/app/data-vault/file-card.component.ts` — displays file icon (by extension), filename (truncated), extension, size, checkbox for bulk select. **Note:** Asset type color-coded tags removed — files are type-agnostic. Future: "Indexed" badge may be added when Story 2.2 implements Knowledge Base indexing.
  - [x] 4.7: **Modify** the existing `path: 'app'` route block in `app.routes.ts` — add `loadComponent: () => import('./app-shell/app-layout.component').then(m => m.AppLayoutComponent)` as the parent layout. Keep the existing `workflows` child route. Add new children: `{ path: 'data-vault', loadComponent: ... DataVaultComponent }` and `{ path: 'data-vault/:folderId', loadComponent: ... DataVaultComponent }`. Update the default redirect from `workflows` to `data-vault`. Guard the parent with `authGuard`.
  - [x] 4.8: Create `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` — simple modal for folder name input.

- [x] **Task 5: Testing** (AC: 10)
  - [x] 5.1: Unit tests for `AssetsService` — upload, duplicate detection, archive/restore, find with filters, SHA-256 hash computation. Use test factories from `@project-bubble/db-layer/testing`.
  - [x] 5.2: Unit tests for `FoldersService` — create, list, rename, delete (reject if non-empty).
  - [x] 5.3: Unit tests for `AssetsController` and `FoldersController` — verify correct service calls, guard configuration, parameter parsing.
  - [x] 5.4: Unit tests for Angular `DataVaultComponent` — renders folder tree, file grid, upload zone. Tests for filter chips, view toggle.
  - [x] 5.5: Unit tests for `AssetService` (Angular) — HTTP calls to correct endpoints.
  - [x] 5.6: Run full test suite: `npx nx run-many --target=test --all`. All 237+ existing tests plus new tests must pass. Run lint: `npx nx run-many --target=lint --all`.

## Dev Notes

### Critical Architecture Constraints

1. **TransactionManager is MANDATORY**: Assets and folders tables have `tenant_id` — they MUST use `TransactionManager` for all DB operations, NOT direct `Repository<T>`. See `project-context.md` Rule #2. Pattern: `this.txManager.run(tenantId, async (manager) => { ... })`.

2. **Shared DTO Rule**: ALL DTOs in `libs/shared/src/lib/dtos/asset/`. Both Angular and NestJS consume the same classes. Add `@ApiProperty` and `class-validator` decorators.

3. **RLS Policy Setup**: Add `'assets'` and `'folders'` to the `tenantScopedTables` array in `RlsSetupService`. Only the standard tenant isolation policy is needed — NO auth bypass policies (unlike users/invitations, assets and folders are only accessed post-authentication).

4. **File Storage (MVP)**: Local disk at `uploads/{tenantId}/`. In production this moves to S3/MinIO — but for MVP, local is fine. Store relative path in DB so migration is just changing the storage adapter.

5. **No Worker Engine for Upload**: File upload is synchronous (small files, <10MB). The >200ms rule applies to heavy processing (vector ingestion in Story 2.2). Upload itself is fast enough for api-gateway.

6. **Angular Patterns (frontend only)**: Standalone components, `inject()` for DI, signals for state, lazy-loaded routes. Follow existing component patterns in `apps/web/src/app/admin/`. NestJS backend services continue to use **constructor injection** (standard NestJS pattern).

7. **Test Factories**: Use `createMockUser()`, `createMockTenant()` from `@project-bubble/db-layer/testing`. Create `createMockAsset()` and `createMockFolder()` factory functions — add them to `libs/db-layer/src/test-utils/factories.ts`.

8. **Test Priority Markers**: New describe blocks use `[P1]` for services, `[P2]` for controllers/components. Test IDs use `[2.1-UNIT-XXX]` format.

### File Storage Path Design

```
uploads/
└── {tenantId}/
    └── {uuid}-{originalName}
```

- UUID prefix prevents filename collisions
- TenantId folder provides physical isolation
- Original name preserved for human readability
- `uploads/` already in `.gitignore` (from Epic 1 — check and add if missing)

### Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| TransactionManager | `@project-bubble/db-layer` | Inject and use `run(tenantId, cb)` |
| RLS policy setup | `libs/db-layer/src/lib/rls-setup.service.ts` | Add `assets` and `folders` tables |
| Entity barrel export | `libs/db-layer/src/lib/entities/index.ts` | Add new entity exports |
| DTO barrel export | `libs/shared/src/lib/dtos/index.ts` | Add new DTO exports |
| JWT guard + Roles guard | `apps/api-gateway/src/app/auth/guards/` | Import and apply to controllers |
| TenantContextInterceptor | Already global via `APP_INTERCEPTOR` | Automatically sets tenant context |
| Admin layout sidebar | `apps/web/src/app/admin/admin-layout.component.*` | Reference for app layout design |
| Test factories | `@project-bubble/db-layer/testing` | Extend with asset/folder factories |
| Dark sidebar CSS | `apps/web/src/app/admin/admin-layout.component.scss` | Copy/adapt for app layout |

### UX Design Reference

**Data Vault page layout** (from UX spec §4.6):
- Left panel: collapsible folder tree
- Main area: file grid (default) or list view toggle
- File cards: file icon (by extension), filename, extension, size
- Upload zone: persistent drag-and-drop at bottom with accepted types
- Header: search input, "Upload Files" primary CTA
- Bulk actions: select multiple → delete, move
- **Note:** Asset type filter chips and color-coded tags removed — files are type-agnostic. Future Story 2.2 will add "Indexed" badge and "Add to Knowledge Base" action.

**File validation** (from UX spec §7):
- Layer 1 (Bouncer): Extension + size validation on upload
- Allowed: `.pdf`, `.txt`, `.md`, `.docx`
- Max size: 10MB
- MIME type validated server-side

**Route**: `/app/data-vault` and `/app/data-vault/:folderId`

### API Endpoint Design

```
# Assets
POST   /api/app/assets          - Upload file (multipart/form-data)
GET    /api/app/assets           - List assets (query: folderId, status)
GET    /api/app/assets/:id       - Get single asset
PATCH  /api/app/assets/:id       - Update metadata (name, folder)
DELETE /api/app/assets/:id       - Soft delete (archive)
POST   /api/app/assets/:id/restore - Restore from archive

# Folders
POST   /api/app/folders          - Create folder
GET    /api/app/folders           - List folders (tree structure)
PATCH  /api/app/folders/:id      - Rename folder
DELETE /api/app/folders/:id      - Delete folder (must be empty)
```

All endpoints require JWT auth. Tenant context extracted from JWT by `TenantContextInterceptor`. RLS enforced via `TransactionManager`.

### Database Schema

```sql
-- assets table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  original_name VARCHAR NOT NULL,
  storage_path VARCHAR NOT NULL,
  mime_type VARCHAR NOT NULL,
  file_size INTEGER NOT NULL,
  sha256_hash VARCHAR(64) NOT NULL,
  is_indexed BOOLEAN NOT NULL DEFAULT false,          -- true when added to Knowledge Base (Story 2.2)
  status VARCHAR NOT NULL DEFAULT 'active',          -- enum: active, archived
  archived_at TIMESTAMP,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Previous Story Learnings (from Story 1H.1)

- Code review found 3-7 issues per story — expect similar. Common patterns: missing input validation, data integrity gaps.
- Use `ParseUUIDPipe` on all `:id` params in controllers.
- Use `@MaxLength()` on string inputs to prevent abuse.
- Add `@ApiProperty` and `@ApiPropertyOptional` decorators on ALL DTO fields.
- Test IDs format: `[2.1-UNIT-XXX]`. Priority markers: `[P1]` for services, `[P2]` for controllers/UI.
- `forwardRef()` may be needed if circular module dependencies arise.

### Scope Boundaries

- **Archive purge NOT in scope**: Automatic deletion of archived files after `assetRetentionDays` is NOT implemented in this story. Only soft-delete (archive) and restore. Purge is a future background job.
- **File content extraction NOT in scope**: Text extraction from PDF/DOCX is Story 2.2 (Vector Ingestion). This story only stores the raw files.

### Dependencies

- No new npm packages needed — `@nestjs/platform-express` already includes multer
- `@types/multer` already in devDependencies for `Express.Multer.File` type
- `crypto` (Node.js built-in) for SHA-256 hash computation
- `fs/promises` (Node.js built-in) for file system operations

### Project Structure Notes

- New NestJS module: `apps/api-gateway/src/app/assets/`
- New Angular components: `apps/web/src/app/app/data-vault/`
- New Angular layout: `apps/web/src/app/app-shell/app-layout.component.ts`
- New entities: `AssetEntity`, `FolderEntity` in `libs/db-layer/`
- New DTOs: `libs/shared/src/lib/dtos/asset/`
- New service: `apps/web/src/app/core/services/asset.service.ts`
- New test factories: extend `libs/db-layer/src/test-utils/factories.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md — Asset Ingestion Service, Queue Pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — §4.6 Data Vault, §7 Data Governance]
- [Source: project-context.md — TransactionManager rule, Shared DTO rule, RLS patterns]
- [Source: stories/1h-1-security-reliability-hardening.md — Hardening patterns and learnings]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- RLS test fix: added assets/folders tables increased query count from 10→16, policy count 2→4
- Multer types: added `"multer"` to tsconfig.spec.json and tsconfig.app.json types arrays
- Auth guard redirect: updated `/app/workflows` → `/app/data-vault` across guards and tests
- Lint fixes: replaced `Function` type with typed callbacks in test mocks, fixed accessibility attributes, renamed `cancel` output to `cancelled`

### Completion Notes List

- All 5 tasks completed: entities, backend services, controllers, UI, tests
- 291 tests passing (237 existing + 54 new): shared 1, db-layer 16, api-gateway 150, web 124
- 0 lint errors across all 5 projects (2 pre-existing warnings in login.component.spec.ts)
- File validation: .pdf/.txt/.md/.docx only, 10MB max, MIME whitelist
- SHA-256 duplicate detection implemented
- Soft delete/archive with restore functionality
- RLS enforced via TransactionManager on all asset/folder operations
- Zone B app layout with dark sidebar created
- Data Vault UI: folder tree, file grid/list, upload zone, filter chips, bulk select
- Accessibility: keyboard handlers on interactive elements, focusable overlays

### Code Review Fixes Applied

- **H1**: ~~Upload zone no longer hardcodes `codebook` — added `assetType` input and type selector dropdown in Data Vault UI~~ → Subsequently removed: `assetType` concept eliminated entirely (see Epic 2 Design Decision)
- **H2**: `storagePath` no longer leaks to clients — `AssetsService.toResponse()` maps entity to DTO excluding internal fields
- **H3**: TOCTOU race in `FoldersService.delete` fixed — consolidated 3 separate transactions into 1 atomic transaction
- **M2**: Duplicate test IDs renumbered — web asset.service.spec uses 045-054, no overlaps
- **M3**: `deleteSelected()` error handling — added error callback to prevent UI getting stuck when archive fails
- **M1**: Folder rename UI added — pencil icon on hover triggers inline rename in folder tree, calls `PATCH /api/app/folders/:id`
- **L2**: 3-level folder nesting — backend enforces max depth of 3 in `FoldersService.create`, UI renders 3 levels (root → nested → nested-2)
- **H4**: FK constraint added — `AssetEntity.folderId` now has `@ManyToOne(() => FolderEntity, { onDelete: 'SET NULL' })` for referential integrity

### Post-Review Design Decision: assetType Removal

After code review, a design discussion identified that `assetType` (codebook/transcript/knowledge) represents workflow-specific labels, not universal file categories. Files should be type-agnostic at upload time. The "type" of a file is assigned at workflow runtime when users select inputs for specific workflow steps.

**Changes applied:**
- Removed `AssetType` enum from `AssetEntity` — replaced with `isIndexed` boolean (default false)
- Removed `AssetTypeDto` enum from DTOs — `UploadAssetDto` and `UpdateAssetDto` no longer have `assetType` field
- Removed `assetType` query parameter from `findAll` in service and controller
- Removed asset type filter chips and type selector from Data Vault UI
- Removed asset type color-coded tags from file cards
- Added `isIndexed` to `AssetResponseDto` for future Knowledge Base indexing (Story 2.2)

### File List

**New Files Created:**
- `libs/db-layer/src/lib/entities/asset.entity.ts` — AssetEntity with enums
- `libs/db-layer/src/lib/entities/folder.entity.ts` — FolderEntity
- `libs/shared/src/lib/dtos/asset/upload-asset.dto.ts` — UploadAssetDto
- `libs/shared/src/lib/dtos/asset/update-asset.dto.ts` — UpdateAssetDto
- `libs/shared/src/lib/dtos/asset/asset-response.dto.ts` — AssetResponseDto
- `libs/shared/src/lib/dtos/asset/create-folder.dto.ts` — CreateFolderDto
- `libs/shared/src/lib/dtos/asset/update-folder.dto.ts` — UpdateFolderDto
- `libs/shared/src/lib/dtos/asset/folder-response.dto.ts` — FolderResponseDto
- `libs/shared/src/lib/dtos/asset/index.ts` — DTO barrel export
- `apps/api-gateway/src/app/assets/assets.module.ts` — AssetsModule
- `apps/api-gateway/src/app/assets/assets.service.ts` — Asset CRUD + upload + SHA-256
- `apps/api-gateway/src/app/assets/folders.service.ts` — Folder CRUD
- `apps/api-gateway/src/app/assets/assets.controller.ts` — Asset REST endpoints
- `apps/api-gateway/src/app/assets/folders.controller.ts` — Folder REST endpoints
- `apps/api-gateway/src/app/assets/assets.service.spec.ts` — 15 unit tests
- `apps/api-gateway/src/app/assets/folders.service.spec.ts` — 10 unit tests
- `apps/api-gateway/src/app/assets/assets.controller.spec.ts` — Controller tests
- `apps/api-gateway/src/app/assets/folders.controller.spec.ts` — Controller tests
- `apps/web/src/app/core/services/asset.service.ts` — Angular HTTP client
- `apps/web/src/app/core/services/asset.service.spec.ts` — 10 HTTP tests
- `apps/web/src/app/app-shell/app-layout.component.ts` — Zone B sidebar layout
- `apps/web/src/app/app-shell/app-layout.component.html` — Layout template
- `apps/web/src/app/app-shell/app-layout.component.scss` — Layout styles
- `apps/web/src/app/app/data-vault/data-vault.component.ts` — Main page
- `apps/web/src/app/app/data-vault/data-vault.component.html` — Main template
- `apps/web/src/app/app/data-vault/data-vault.component.scss` — Main styles
- `apps/web/src/app/app/data-vault/data-vault.component.spec.ts` — 6 UI tests
- `apps/web/src/app/app/data-vault/upload-zone.component.ts` — Drag-drop upload
- `apps/web/src/app/app/data-vault/folder-tree.component.ts` — Folder tree
- `apps/web/src/app/app/data-vault/file-card.component.ts` — File card grid/list
- `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` — Create folder modal

**Modified Files:**
- `libs/db-layer/src/lib/entities/index.ts` — Added entity exports
- `libs/db-layer/src/lib/rls-setup.service.ts` — Added assets/folders to tenantScopedTables
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` — Updated query/policy counts
- `libs/db-layer/src/test-utils/factories.ts` — Added createMockAsset/createMockFolder
- `libs/db-layer/src/test-utils/index.ts` — Added factory exports
- `libs/shared/src/lib/dtos/index.ts` — Added asset DTO exports
- `apps/api-gateway/src/app/app.module.ts` — Registered AssetsModule
- `apps/api-gateway/tsconfig.spec.json` — Added multer types
- `apps/api-gateway/tsconfig.app.json` — Added multer types
- `apps/web/src/app/app.routes.ts` — Added AppLayoutComponent + data-vault routes
- `apps/web/src/app/core/services/auth.service.ts` — Updated getRoleHome to /app/data-vault
- `apps/web/src/app/core/guards/auth.guard.ts` — Updated redirect to /app/data-vault
- `apps/web/src/app/core/guards/auth.guard.spec.ts` — Updated redirect expectations
- `apps/web/src/app/core/guards/no-auth.guard.ts` — Updated redirect to /app/data-vault
- `.gitignore` — Added uploads/
