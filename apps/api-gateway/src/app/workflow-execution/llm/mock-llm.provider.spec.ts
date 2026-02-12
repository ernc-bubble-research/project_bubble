import { MockLlmProvider } from './mock-llm.provider';

describe('MockLlmProvider', () => {
  let provider: MockLlmProvider;

  beforeEach(() => {
    // latencyMs=0 for fast tests
    provider = new MockLlmProvider(0);
  });

  // [4.2-UNIT-006] Same prompt produces identical response
  it('should produce deterministic responses for the same prompt', async () => {
    const prompt = 'Analyze the quarterly report';
    const result1 = await provider.generate(prompt, {});
    const result2 = await provider.generate(prompt, {});

    expect(result1.text).toBe(result2.text);
    expect(result1.tokenUsage).toEqual(result2.tokenUsage);
  });

  // [4.2-UNIT-007] Different prompts produce different responses
  it('should produce different responses for different prompts', async () => {
    const result1 = await provider.generate('Prompt A', {});
    const result2 = await provider.generate('Prompt B', {});

    expect(result1.text).not.toBe(result2.text);
  });

  // [4.2-UNIT-008] Response is valid markdown with expected sections
  it('should return valid markdown with expected sections', async () => {
    const result = await provider.generate('Any prompt', {});

    expect(result.text).toContain('# Analysis Report');
    expect(result.text).toContain('## Summary');
    expect(result.text).toContain('## Findings');
    expect(result.text).toContain('## Conclusion');
  });

  // [4.2-UNIT-009] Synthetic token usage calculation
  it('should calculate synthetic token usage based on character count', async () => {
    const prompt = 'A'.repeat(100); // 100 chars → 25 input tokens
    const result = await provider.generate(prompt, {});

    expect(result.tokenUsage.inputTokens).toBe(25);
    expect(result.tokenUsage.outputTokens).toBe(
      Math.ceil(result.text.length / 4),
    );
    expect(result.tokenUsage.totalTokens).toBe(
      result.tokenUsage.inputTokens + result.tokenUsage.outputTokens,
    );
  });

  // [4.2-UNIT-010] Handles empty prompt
  it('should handle empty prompt without errors', async () => {
    const result = await provider.generate('', {});

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.tokenUsage.inputTokens).toBe(0);
  });

  // [4.2-UNIT-011] Options are accepted but do not affect deterministic output
  it('should accept options without affecting output', async () => {
    const prompt = 'Test prompt';
    const result1 = await provider.generate(prompt, {
      temperature: 0.5,
      maxOutputTokens: 100,
    });
    const result2 = await provider.generate(prompt, {
      temperature: 1.0,
      maxOutputTokens: 4000,
    });

    expect(result1.text).toBe(result2.text);
  });

  // [4.2-UNIT-012] Simulated latency
  it('should simulate latency when configured', async () => {
    const slowProvider = new MockLlmProvider(100);
    const start = Date.now();
    await slowProvider.generate('Test', {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90); // allow small timing variance
  });

  // [4.2-UNIT-013] Zero latency when set to 0
  it('should skip latency when set to 0', async () => {
    const start = Date.now();
    await provider.generate('Test', {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});
