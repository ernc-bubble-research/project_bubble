# LLM Provider Operations Runbook

## Canary Tests

### What are canary tests?

Canary tests are real API integration tests that validate our SDK wrapper (`GoogleAIStudioLlmProvider`) works correctly against the live Google AI Studio API. They are **skipped by default** in CI and normal development — they exist solely for manual validation when the SDK or API contract might have changed.

The canary test file is: `google-ai-studio-llm.provider.canary.spec.ts`

### When to run canary tests

| Trigger | Action |
|---|---|
| **Before SDK upgrade** | Run canary with current SDK to establish baseline |
| **After SDK upgrade** | Run canary with new SDK to verify compatibility |
| **Production LLM failures** | Run canary to rule out SDK issues |
| **Monthly review** | Check @google/generative-ai changelog for breaking changes |

### How to run

1. Ensure `GEMINI_API_KEY` is set in your environment (`.env` or shell export)
2. Open the canary test file (it ships with `describe.skip` by default) and change `describe.skip(` to `describe(`
3. Run: `npx nx test api-gateway --testPathPatterns="canary"`
4. **Restore** `describe.skip` after testing (do NOT commit with `.skip` removed — CI should never run real API calls)

### What to do if canary fails

1. **Check the error message** — is it an auth error (invalid key), rate limit (429), or SDK breaking change?
2. **If auth error**: Verify your `GEMINI_API_KEY` is valid and has quota remaining
3. **If rate limit**: Wait a minute and retry, or use a different API key
4. **If SDK breaking change**:
   - Check the [@google/generative-ai changelog](https://www.npmjs.com/package/@google/generative-ai)
   - Look for changes to `generateContent()`, `usageMetadata`, or response shape
   - Update `GoogleAIStudioLlmProvider` to match the new API
   - Run canary again to verify the fix
   - File an issue if the change requires significant refactoring

### SOP Cadence

- **Daily**: N/A — canary is not part of CI
- **Weekly**: N/A — only run on trigger events
- **Monthly**: Review SDK changelog for breaking changes or deprecation notices
- **Before deployment**: Run canary IF the `@google/generative-ai` package was updated in this release
- **Before SDK upgrades**: Run canary BEFORE the upgrade (baseline) AND AFTER (validation)
