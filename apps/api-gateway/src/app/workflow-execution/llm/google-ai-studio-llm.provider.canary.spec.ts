/**
 * Google AI Studio LLM Provider — Canary Tests
 *
 * PURPOSE: Validate SDK compatibility with a REAL Google AI Studio API call.
 * These tests are skipped by default and should only be enabled manually.
 *
 * WHEN TO RUN:
 * - Before upgrading the @google/generative-ai SDK version
 * - After upgrading the SDK to verify the new version still works
 * - When debugging production LLM failures that might be SDK-related
 *
 * HOW TO RUN:
 * 1. Ensure GEMINI_API_KEY is set in your .env or environment
 * 2. Change `describe.skip` to `describe` below
 * 3. Run: npx nx test api-gateway --testPathPatterns="canary"
 * 4. Restore `describe.skip` after testing
 *
 * See operations runbook (ops-runbook.md) for full SOP and cadence.
 */

import { GoogleAIStudioLlmProvider } from './google-ai-studio-llm.provider';

describe.skip('GoogleAIStudio Canary [MANUAL]', () => {
  let provider: GoogleAIStudioLlmProvider;

  beforeAll(() => {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY not set — canary tests require a real API key',
      );
    }
    provider = new GoogleAIStudioLlmProvider(apiKey, 'gemini-1.5-pro');
  });

  it('should generate content with real API', async () => {
    const result = await provider.generate(
      'Say exactly: "Hello from canary test"',
      { temperature: 0, maxOutputTokens: 50 },
    );

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.tokenUsage.inputTokens).toBeGreaterThan(0);
    expect(result.tokenUsage.outputTokens).toBeGreaterThan(0);
    expect(result.tokenUsage.totalTokens).toBeGreaterThan(0);
  }, 30_000);

  it('should report accurate token counts', async () => {
    const result = await provider.generate('What is 2+2? Answer briefly.', {
      temperature: 0,
      maxOutputTokens: 100,
    });

    // Basic sanity: total should be sum of input + output
    expect(result.tokenUsage.totalTokens).toBe(
      result.tokenUsage.inputTokens + result.tokenUsage.outputTokens,
    );
  }, 30_000);
});
