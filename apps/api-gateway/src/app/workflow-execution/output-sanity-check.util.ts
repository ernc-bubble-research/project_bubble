/**
 * Sanity checks for LLM output text.
 * NOT structural validation — we check "did we get something usable?"
 * not "is the document structure correct?" (prompt engineering concern).
 */

const MIN_OUTPUT_LENGTH = 50;

export interface SanityCheckResult {
  valid: boolean;
  reason?: string;
}

export function validateLlmOutput(
  text: unknown,
  tokenBudget?: number,
): SanityCheckResult {
  // Check 1: non-null, non-undefined
  if (text === null || text === undefined) {
    return { valid: false, reason: 'LLM returned null or undefined response' };
  }

  // Check 2: must be a string
  if (typeof text !== 'string') {
    return { valid: false, reason: `LLM returned non-string type: ${typeof text}` };
  }

  // Check 3: non-empty after trimming
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'LLM returned empty response' };
  }

  // Check 4: minimum length (>50 chars) — catches garbage/stub responses
  if (trimmed.length < MIN_OUTPUT_LENGTH) {
    return {
      valid: false,
      reason: `LLM response too short (${trimmed.length} chars, minimum ${MIN_OUTPUT_LENGTH})`,
    };
  }

  // Check 5: within token budget (estimate: 1 token ≈ 4 chars)
  if (tokenBudget !== undefined && tokenBudget > 0) {
    const estimatedTokens = Math.ceil(trimmed.length / 4);
    if (estimatedTokens > tokenBudget) {
      return {
        valid: false,
        reason: `LLM response exceeds token budget (~${estimatedTokens} tokens, budget: ${tokenBudget})`,
      };
    }
  }

  return { valid: true };
}
