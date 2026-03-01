'use strict';

/**
 * check-tenant-id.js
 *
 * Detects TypeORM EntityManager operations missing tenantId in WHERE clauses.
 * Rule 2c enforcement — project-context.md §"2c. Defense-in-Depth"
 *
 * Usage:
 *   node scripts/check-tenant-id.js           # warn mode (exit 0, prints violations)
 *   node scripts/check-tenant-id.js --strict  # strict mode (exit 1 if violations found)
 *
 * Permanent exceptions are in scripts/tenant-id-allowlist.conf
 *
 * KNOWN LIMITATIONS (documented, by design):
 *
 * 1. Context allowlist window (30-line look-back) is method-boundary-agnostic.
 *    A genuine violation that appears within 30 lines of an allowlisted method name
 *    (e.g. findPublishedOne) may be incorrectly suppressed. Risk is low given that
 *    allowlisted method names are highly specific, but reviewers should manually verify
 *    files that heavily use catalog-read methods alongside tenant-scoped writes.
 *
 * 2. Commented-out code is not stripped before scanning. A line like:
 *    //   const x = await manager.findOne(AssetEntity, { where: { id } });
 *    will be flagged as a violation. This is expected and acceptable — commented-out
 *    code that would violate Rule 2c should either be fixed before commenting or removed.
 */

const fs = require('fs');
const path = require('path');

// find-like ops: use { where: { ... } } in options object
const FIND_OPS = [
  'manager.findOne(',
  'manager.findAndCount(',
  'manager.count(',
  'manager.find(', // must be after findOne/findAndCount to avoid substring issues
];

// write-like ops: criteria is the 2nd argument directly (no 'where:' keyword)
const WRITE_OPS = [
  'manager.softDelete(', // before delete to avoid substring collision
  'manager.delete(',
  'manager.restore(',
  'manager.update(',
  'manager.countBy(',
];

const ALL_OPS = [...FIND_OPS, ...WRITE_OPS];
const QUERY_OP = 'manager.query(';

// Window size constants — changing these affects detection coverage vs false-positive risk.
// See KNOWN LIMITATIONS in the file header before adjusting.
const TYPEORM_WINDOW_LINES = 10;       // max forward lines for TypeORM op window
const QUERY_LOOKBACK_LINES = 5;        // lines to look back for manager.query() tenantId
const QUERY_LOOKAHEAD_LINES = 15;      // lines to look ahead for manager.query() tenantId
const CONTEXT_ALLOWLIST_LOOKBACK = 30; // lines to look back for context allowlist patterns

/**
 * Load allowlist patterns from conf file.
 * Lines starting with '#' are comments. Empty lines are ignored.
 * Returns { filePatterns: string[], contextPatterns: string[] }
 *   filePatterns   — matched against file path substring (contain '.' or '/')
 *   contextPatterns — matched against surrounding code context (method names etc.)
 */
function loadAllowlist(allowlistPath) {
  if (!fs.existsSync(allowlistPath)) {
    console.warn(`[WARN] Allowlist file not found: ${allowlistPath} — running with no exceptions. All permanently-exempt files (auth.service.ts, tenants.service.ts, etc.) will be reported.`);
    return { filePatterns: [], contextPatterns: [] };
  }
  const lines = fs.readFileSync(allowlistPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const filePatterns = lines.filter(p => p.includes('.') || p.includes('/'));
  const contextPatterns = lines.filter(p => !p.includes('.') && !p.includes('/'));
  return { filePatterns, contextPatterns };
}

/**
 * Returns true if the file path matches any file-level allowlist pattern.
 * Patterns WITHOUT '/' are matched against the basename only (exact match) to prevent
 * substring collisions — e.g. 'auth.service.ts' must NOT match 'tenant-auth.service.ts'.
 * Patterns WITH '/' are matched against the full normalized path (substring match).
 */
function isFileLevelAllowlisted(filePath, filePatterns) {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop();
  return filePatterns.some(p =>
    p.includes('/') ? normalized.includes(p) : basename === p,
  );
}

/**
 * Returns true if any context-level allowlist pattern appears in the given text.
 * Used to suppress violations inside known-exempt methods (e.g. findPublishedOne).
 */
function isContextAllowlisted(contextText, contextPatterns) {
  return contextPatterns.some(p => contextText.includes(p));
}

/**
 * Core detection function. Exported for unit testing.
 *
 * @param {string} source    — file content as string
 * @param {string} filename  — relative file path (used for allowlist matching + spec exclusion)
 * @param {string[]} filePatterns   — file-level allowlist patterns
 * @param {string[]} contextPatterns — context-level allowlist patterns
 * @returns {{ lineNum: number, line: string, type: string }[]}
 */
function checkFileContent(source, filename, filePatterns, contextPatterns) {
  const violations = [];

  // Exclude spec/test files
  if (
    filename.endsWith('.spec.ts') ||
    filename.endsWith('.test.ts') ||
    filename.endsWith('.spec.js') ||
    filename.endsWith('.test.js')
  ) {
    return violations;
  }

  // Exclude file-level allowlisted files
  if (isFileLevelAllowlisted(filename, filePatterns)) {
    return violations;
  }

  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── manager.query() check ──────────────────────────────────────────────
    if (line.includes(QUERY_OP)) {
      // Look back 5 lines: catches txManager.run(tenantId, async (manager) => { manager.query(...) }
      // Look ahead 15 lines: catches long SQL strings where params array is many lines down
      const lookBack = lines.slice(Math.max(0, i - QUERY_LOOKBACK_LINES), i).join('\n');
      const lookAhead = lines.slice(i, Math.min(i + QUERY_LOOKAHEAD_LINES + 1, lines.length)).join('\n');
      const queryWindow = lookBack + '\n' + lookAhead;
      if (!queryWindow.includes('tenantId') && !queryWindow.includes('tenant_id')) {
        // Check context allowlist (CONTEXT_ALLOWLIST_LOOKBACK-line look-back + forward window)
        const contextWindow = lines
          .slice(Math.max(0, i - CONTEXT_ALLOWLIST_LOOKBACK), Math.min(i + QUERY_LOOKAHEAD_LINES + 1, lines.length))
          .join('\n');
        if (!isContextAllowlisted(contextWindow, contextPatterns)) {
          violations.push({
            lineNum: i + 1,
            line: line.trim(),
            type: 'manager.query() missing tenantId/tenant_id parameter',
          });
        }
      }
      continue;
    }

    // ── TypeORM operation check ────────────────────────────────────────────
    const matchedOp = ALL_OPS.find(op => line.includes(op));
    if (!matchedOp) continue;

    const isFindLike = FIND_OPS.includes(matchedOp);

    // Build forward window: up to 10 lines, terminating at next manager. call (Winston fix)
    const windowLines = [line];
    for (let j = i + 1; j < Math.min(i + TYPEORM_WINDOW_LINES + 1, lines.length); j++) {
      if (ALL_OPS.some(op => lines[j].includes(op)) || lines[j].includes(QUERY_OP)) {
        break; // Stop at next TypeORM operation — prevents cross-call false passes
      }
      windowLines.push(lines[j]);
    }
    const window = windowLines.join('\n');

    // For find-like ops: only flag if an explicit where: clause exists
    // manager.find(Entity) with no options = RLS-only = valid (Murat: test-008 guard)
    if (isFindLike && !window.includes('where:')) {
      continue;
    }

    // Compliant — tenantId present
    if (window.includes('tenantId')) {
      continue;
    }

    // Check context allowlist (CONTEXT_ALLOWLIST_LOOKBACK-line look-back + window)
    const contextWindow = lines
      .slice(Math.max(0, i - CONTEXT_ALLOWLIST_LOOKBACK), Math.min(i + windowLines.length + 1, lines.length))
      .join('\n');
    if (isContextAllowlisted(contextWindow, contextPatterns)) {
      continue;
    }

    violations.push({
      lineNum: i + 1,
      line: line.trim(),
      type: `${matchedOp.trim()} missing tenantId in WHERE/criteria`,
    });
  }

  return violations;
}

/**
 * Recursively find all .ts files in a directory, excluding spec/test files.
 */
function findTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.test.ts')
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * CLI entry point.
 */
function main() {
  const strict = process.argv.includes('--strict');
  const projectRoot = path.resolve(__dirname, '..');
  const allowlistPath = path.join(__dirname, 'tenant-id-allowlist.conf');
  const { filePatterns, contextPatterns } = loadAllowlist(allowlistPath);

  const scanDirs = [
    path.join(projectRoot, 'apps', 'api-gateway', 'src'),
    path.join(projectRoot, 'apps', 'worker-engine', 'src'),
  ];

  const allViolations = [];

  for (const dir of scanDirs) {
    const files = findTsFiles(dir);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(projectRoot, file).replace(/\\/g, '/');
      const violations = checkFileContent(source, relPath, filePatterns, contextPatterns);
      for (const v of violations) {
        allViolations.push({ file: relPath, ...v });
      }
    }
  }

  // Output
  for (const v of allViolations) {
    console.log(`[VIOLATION] ${v.file}:${v.lineNum} — ${v.type}`);
  }

  const count = allViolations.length;
  if (count === 0) {
    console.log('[PASS] 0 violations found');
    process.exit(0);
  } else if (strict) {
    console.log(`[FAIL] ${count} violation${count === 1 ? '' : 's'} found`);
    process.exit(1);
  } else {
    console.log(`[WARN] ${count} violation${count === 1 ? '' : 's'} found (run with --strict to fail CI)`);
    process.exit(0);
  }
}

// Export for unit testing
module.exports = { checkFileContent, loadAllowlist, isFileLevelAllowlisted, isContextAllowlisted, findTsFiles };

// Run if invoked directly
if (require.main === module) {
  main();
}
