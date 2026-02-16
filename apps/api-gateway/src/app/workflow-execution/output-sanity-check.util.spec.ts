import { validateLlmOutput } from './output-sanity-check.util';

describe('validateLlmOutput', () => {
  const validText = 'A'.repeat(100); // 100 chars — well above minimum

  it('[4-5-UNIT-001] should accept valid text above minimum length', () => {
    const result = validateLlmOutput(validText);
    expect(result).toEqual({ valid: true });
  });

  it('[4-5-UNIT-002] should reject null input', () => {
    const result = validateLlmOutput(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('null or undefined');
  });

  it('[4-5-UNIT-003] should reject undefined input', () => {
    const result = validateLlmOutput(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('null or undefined');
  });

  it('[4-5-UNIT-004] should reject non-string input', () => {
    const result = validateLlmOutput(42);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('non-string type');
  });

  it('[4-5-UNIT-005] should reject empty string', () => {
    const result = validateLlmOutput('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty response');
  });

  it('[4-5-UNIT-006] should reject whitespace-only string', () => {
    const result = validateLlmOutput('   \n\t  ');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty response');
  });

  it('[4-5-UNIT-007] should reject text below minimum length (50 chars)', () => {
    const result = validateLlmOutput('Short text only 30 chars here.');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too short');
    expect(result.reason).toContain('minimum 50');
  });

  it('[4-5-UNIT-008] should accept text at exactly 50 chars', () => {
    const text = 'A'.repeat(50);
    const result = validateLlmOutput(text);
    expect(result).toEqual({ valid: true });
  });

  it('[4-5-UNIT-009] should reject text exceeding token budget', () => {
    // 400 chars ≈ 100 tokens; budget of 50
    const longText = 'A'.repeat(400);
    const result = validateLlmOutput(longText, 50);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds token budget');
  });

  it('[4-5-UNIT-010] should accept text within token budget', () => {
    // 100 chars ≈ 25 tokens; budget of 100
    const result = validateLlmOutput(validText, 100);
    expect(result).toEqual({ valid: true });
  });

  it('[4-5-UNIT-011] should skip token budget check when budget is undefined', () => {
    const longText = 'A'.repeat(10000);
    const result = validateLlmOutput(longText);
    expect(result).toEqual({ valid: true });
  });

  it('[4-5-UNIT-012] should skip token budget check when budget is 0', () => {
    const longText = 'A'.repeat(10000);
    const result = validateLlmOutput(longText, 0);
    expect(result).toEqual({ valid: true });
  });
});
