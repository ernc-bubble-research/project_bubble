'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkFileContent, loadAllowlist, isFileLevelAllowlisted } = require('./check-tenant-id');

// Allowlist fixtures
const filePatterns = ['auth.service.ts', 'llm-models.service.ts'];
const contextPatterns = ['findPublishedOne', 'findAccessibleByTenant'];

describe('[P1] check-tenant-id detection logic', () => {
  // ── [4-5-1-UNIT-001] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-001] findOne WITH tenantId in WHERE → no violation', () => {
    const source = `
      const asset = await manager.findOne(AssetEntity, {
        where: { id: assetId, tenantId },
      });
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-002] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-002] findOne WITHOUT tenantId in WHERE → violation detected', () => {
    const source = `
      const asset = await manager.findOne(AssetEntity, {
        where: { id: assetId },
      });
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toContain('manager.findOne(');
    expect(violations[0].lineNum).toBe(2); // line 1 is the leading \n in the template literal
  });

  // ── [4-5-1-UNIT-003] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-003] find() without tenantId on multi-line where → violation detected', () => {
    const source = `
      const assets = await manager.find(AssetEntity, {
        where: {
          folderId,
          isActive: true,
        },
        order: { createdAt: 'DESC' },
      });
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toContain('manager.find(');
  });

  // ── [4-5-1-UNIT-004] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-004] file matching file-level allowlist pattern → violation suppressed', () => {
    const source = `
      const user = await manager.findOne(UserEntity, {
        where: { email },
      });
    `;
    // auth.service.ts is in filePatterns — whole file suppressed
    const violations = checkFileContent(
      source,
      'apps/api-gateway/src/app/auth/auth.service.ts',
      filePatterns,
      contextPatterns,
    );
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-005] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-005] manager.query() with tenant_id parameter → no violation', () => {
    const source = `
      const result = await manager.query(
        \`UPDATE workflow_run_entities SET status = $1 WHERE id = $2 AND tenant_id = $3\`,
        [status, runId, tenantId],
      );
    `;
    const violations = checkFileContent(source, 'processor.ts', [], []);
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-006] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-006] manager.query() without tenant_id, not allowlisted → violation detected', () => {
    const source = `
      const result = await manager.query(
        \`UPDATE some_entities SET status = $1 WHERE id = $2\`,
        [status, entityId],
      );
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toContain('manager.query()');
  });

  // ── [4-5-1-UNIT-007] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-007] *.spec.ts file → always excluded regardless of content', () => {
    const source = `
      const asset = await manager.findOne(AssetEntity, {
        where: { id: assetId },
      });
    `;
    // Even though there's a clear violation, spec files are excluded
    const violations = checkFileContent(source, 'some-service.spec.ts', [], []);
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-008] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-008] manager.find(Entity) with NO where clause → no violation (false-positive guard)', () => {
    // Relies on RLS alone — valid for list operations without explicit WHERE
    const source = `
      const allItems = await manager.find(SomeEntity);
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(0);
  });

  // ── Additional coverage ───────────────────────────────────────────────────

  it('[4-5-1-UNIT-009] manager.update() without tenantId in criteria → violation detected', () => {
    // Write-like op: criteria is 2nd arg, no 'where:' keyword — must still be caught
    const source = `
      await manager.update(AssetEntity, { id: assetId }, { isIndexed: true });
    `;
    const violations = checkFileContent(source, 'ingestion.service.ts', [], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toContain('manager.update(');
  });

  it('[4-5-1-UNIT-010] context-level allowlist suppresses violation inside exempt method', () => {
    // findPublishedOne is in contextPatterns — violations within 30 lines are suppressed
    const source = `
      async findPublishedOne(id, requestingTenantId) {
        return this.txManager.run(async (manager) => {
          return manager.findOne(WorkflowTemplateEntity, {
            where: { id, status: 'PUBLISHED' },
          });
        });
      }
    `;
    const violations = checkFileContent(source, 'workflow-templates.service.ts', [], contextPatterns);
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-011] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-011] two back-to-back findOne calls — window termination prevents false pass', () => {
    // Winston fix: window must stop at next manager. call
    const source = `
      const a = await manager.findOne(AssetEntity, { where: { id: id1 } });
      const b = await manager.findOne(AssetEntity, { where: { id: id2, tenantId } });
    `;
    // First call is a violation; second call is compliant.
    // Without window termination, first call's window would see second call's tenantId.
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(1);
    expect(violations[0].lineNum).toBe(2); // first call, line 2
  });

  // ── [4-5-1-UNIT-012] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-012] manager.query() with tenantId in txManager.run() wrapper above → no violation (look-back)', () => {
    // txManager.run(tenantId, ...) places tenantId ABOVE the manager.query() call.
    // The 5-line look-back must catch it — forward-only window would miss it.
    const source = `
      await txManager.run(tenantId, async (manager) => {
        const result = await manager.query(
          \`SELECT * FROM assets WHERE id = $1\`,
          [assetId],
        );
        return result;
      });
    `;
    const violations = checkFileContent(source, 'some.service.ts', [], []);
    expect(violations).toHaveLength(0);
  });

  // ── [4-5-1-UNIT-013] ──────────────────────────────────────────────────────
  it('[4-5-1-UNIT-013] file-level allowlist does NOT suppress files with overlapping names (N2-1 regression)', () => {
    // Regression guard: 'auth.service.ts' must NOT substring-match 'tenant-auth.service.ts'.
    // isFileLevelAllowlisted now uses exact basename match for patterns without '/'.
    const source = `
      const user = await manager.findOne(UserEntity, {
        where: { email },
      });
    `;
    // Should be suppressed — exact match
    const suppressed = checkFileContent(
      source,
      'apps/api-gateway/src/app/auth/auth.service.ts',
      ['auth.service.ts'],
      [],
    );
    expect(suppressed).toHaveLength(0);

    // Should NOT be suppressed — 'auth.service.ts' ≠ basename 'tenant-auth.service.ts'
    const notSuppressed = checkFileContent(
      source,
      'apps/api-gateway/src/app/auth/tenant-auth.service.ts',
      ['auth.service.ts'],
      [],
    );
    expect(notSuppressed).toHaveLength(1);
  });
});

// ── loadAllowlist parsing (M3-2) ───────────────────────────────────────────

describe('[P1] loadAllowlist parsing', () => {
  let tmpFile;

  beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), 'check-tenant-id-test.conf');
    fs.writeFileSync(tmpFile, [
      '# This is a comment — must be stripped',
      'auth.service.ts',
      'invitations.service.ts',
      'some/path/service.ts',
      '',
      '# Context pattern section',
      'findPublishedOne',
      'findAccessibleByTenant',
    ].join('\n'), 'utf-8');
  });

  afterAll(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('categorizes entries with "." or "/" as file patterns', () => {
    const { filePatterns } = loadAllowlist(tmpFile);
    expect(filePatterns).toContain('auth.service.ts');
    expect(filePatterns).toContain('invitations.service.ts');
    expect(filePatterns).toContain('some/path/service.ts');
  });

  it('categorizes entries without "." or "/" as context patterns', () => {
    const { contextPatterns } = loadAllowlist(tmpFile);
    expect(contextPatterns).toContain('findPublishedOne');
    expect(contextPatterns).toContain('findAccessibleByTenant');
  });

  it('strips comment lines and empty lines', () => {
    const { filePatterns, contextPatterns } = loadAllowlist(tmpFile);
    const all = [...filePatterns, ...contextPatterns];
    expect(all.some(p => p.startsWith('#'))).toBe(false);
    expect(all).not.toContain('');
  });

  it('returns empty arrays when allowlist file does not exist', () => {
    const { filePatterns, contextPatterns } = loadAllowlist('/nonexistent/path/allowlist.conf');
    expect(filePatterns).toHaveLength(0);
    expect(contextPatterns).toHaveLength(0);
  });
});

// ── isFileLevelAllowlisted direct API (M3-2 / N2-1 regression) ────────────

describe('[P1] isFileLevelAllowlisted', () => {
  it('exact basename match: suppresses correct file, spares overlapping name', () => {
    expect(isFileLevelAllowlisted('apps/auth/auth.service.ts', ['auth.service.ts'])).toBe(true);
    expect(isFileLevelAllowlisted('apps/auth/tenant-auth.service.ts', ['auth.service.ts'])).toBe(false);
    expect(isFileLevelAllowlisted('apps/auth/oauth.service.ts', ['auth.service.ts'])).toBe(false);
  });

  it('path pattern (contains "/"): uses substring match on full path', () => {
    expect(isFileLevelAllowlisted('apps/api-gateway/src/admin/service.ts', ['api-gateway/src/admin'])).toBe(true);
    expect(isFileLevelAllowlisted('apps/worker-engine/src/admin/service.ts', ['api-gateway/src/admin'])).toBe(false);
  });
});
