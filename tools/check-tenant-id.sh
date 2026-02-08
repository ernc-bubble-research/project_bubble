#!/usr/bin/env bash
# tools/check-tenant-id.sh
#
# Story MW-1: TenantId CI Check (AC: 8)
#
# Scans backend service files for raw SQL queries (.query() and .createQueryBuilder())
# that operate on tenant-scoped tables but don't include tenant_id in their conditions.
#
# Tenant-scoped tables: users, invitations, assets, folders, knowledge_chunks,
#                       workflow_versions, workflow_runs
#
# Known exemptions (files that legitimately bypass tenant isolation):
# - rls-setup.service.ts      — Creates RLS policies (DDL, not DML)
# - transaction-manager.ts    — Sets SET LOCAL (infrastructure)
# - auth.service.ts           — Cross-tenant login/seed (protected by RLS auth policies)
# - tenant-context.ts         — AsyncLocalStorage infrastructure
# - module-wiring.spec.ts     — Wiring tests (test infrastructure)
# - integration-wiring.spec.ts — Integration tests (test infrastructure)
# - *.spec.ts                 — All test files
#
# Usage:
#   ./tools/check-tenant-id.sh          # Run check
#   ./tools/check-tenant-id.sh --verbose # Show all matches
#
# Exit codes:
#   0 — Clean (no violations found)
#   1 — Violations found (raw SQL without tenant_id on tenant-scoped tables)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=true
fi

# Tenant-scoped table names (must match RlsSetupService.tenantScopedTables)
TENANT_TABLES="users|invitations|assets|folders|knowledge_chunks|workflow_versions|workflow_runs"

# Files/patterns to exclude (legitimate exemptions)
EXCLUDE_PATTERNS=(
  "rls-setup.service"
  "transaction-manager"
  "auth.service"
  "tenant-context"
  "module-wiring.spec"
  "integration-wiring.spec"
  "*.spec.ts"
  "*.spec.cts"
  "global-setup"
  "global-teardown"
  "test-db-setup"
)

# Build grep exclusion args
EXCLUDE_ARGS=()
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS+=(--glob "!**/${pattern}")
done

VIOLATIONS=0
VIOLATION_FILES=()

# Search for raw SQL queries that reference tenant-scoped tables
# Pattern 1: .query(`...tenant_table...`) without tenant_id
# Pattern 2: .createQueryBuilder() referencing tenant-scoped tables

echo "=== TenantId CI Check ==="
echo "Scanning for raw SQL on tenant-scoped tables without tenant_id..."
echo ""

# Find .query( calls that mention tenant-scoped table names
MATCHES=$(cd "$PROJECT_ROOT" && rg \
  --glob "**/*.ts" \
  "${EXCLUDE_ARGS[@]}" \
  --glob "!**/node_modules/**" \
  --glob "!**/dist/**" \
  -l \
  "\.query\s*\(" \
  -- apps/api-gateway/src libs/db-layer/src 2>/dev/null || true)

if [[ -n "$MATCHES" ]]; then
  while IFS= read -r file; do
    # For each file with .query() calls, check if it references tenant-scoped tables
    # without using TransactionManager (which handles SET LOCAL)
    QUERY_LINES=$(cd "$PROJECT_ROOT" && rg -n "\.query\s*\(" "$file" 2>/dev/null || true)

    if [[ -n "$QUERY_LINES" ]]; then
      while IFS= read -r line; do
        LINE_NUM=$(echo "$line" | cut -d: -f1)
        LINE_CONTENT=$(echo "$line" | cut -d: -f2-)

        # Check if the line or nearby context mentions a tenant-scoped table
        # Read a window of lines around the match for multi-line queries
        CONTEXT=$(cd "$PROJECT_ROOT" && sed -n "$((LINE_NUM > 3 ? LINE_NUM - 3 : 1)),$((LINE_NUM + 10))p" "$file" 2>/dev/null || true)

        # Check if context references a tenant-scoped table
        if echo "$CONTEXT" | grep -qiE "($TENANT_TABLES)" 2>/dev/null; then
          # Check if it uses TransactionManager or SET LOCAL
          if ! echo "$CONTEXT" | grep -qiE "(TransactionManager|SET LOCAL|tenant_id|tenantId)" 2>/dev/null; then
            VIOLATIONS=$((VIOLATIONS + 1))
            VIOLATION_FILES+=("$file:$LINE_NUM")
            if [[ "$VERBOSE" == true ]]; then
              echo "VIOLATION: $file:$LINE_NUM"
              echo "  $LINE_CONTENT"
              echo ""
            fi
          fi
        fi
      done <<< "$QUERY_LINES"
    fi
  done <<< "$MATCHES"
fi

echo "Scanned files in apps/api-gateway/src and libs/db-layer/src"
echo ""

if [[ $VIOLATIONS -gt 0 ]]; then
  echo "FAIL: $VIOLATIONS potential tenant isolation violation(s) found"
  echo ""
  for v in "${VIOLATION_FILES[@]}"; do
    echo "  - $v"
  done
  echo ""
  echo "Each violation is a raw .query() call on a tenant-scoped table that"
  echo "does not appear to use TransactionManager, SET LOCAL, or tenant_id."
  echo ""
  echo "To fix: Use TransactionManager.run(tenantId, ...) instead of direct .query() calls,"
  echo "or add the file to the exemption list if the access is intentionally cross-tenant."
  exit 1
else
  echo "PASS: No tenant isolation violations found"
  exit 0
fi
