import { createHash } from 'crypto';
import { LLMProvider, LLMGenerateOptions, LLMGenerateResult } from './llm.provider';

/**
 * MockLlmProvider — deterministic fake LLM for development and testing.
 *
 * - Same prompt always produces the same response (hash-based).
 * - Configurable latency via constructor arg (defaults to MOCK_LLM_LATENCY_MS env var, then 500ms).
 * - Synthetic token usage: inputTokens = ceil(prompt.length / 4), outputTokens = ceil(response.length / 4).
 * - No credentials required.
 */
export class MockLlmProvider implements LLMProvider {
  private readonly latencyMs: number;

  constructor(latencyMs?: number) {
    this.latencyMs =
      latencyMs ??
      parseInt(process.env['MOCK_LLM_LATENCY_MS'] || '500', 10);
  }

  async generate(
    prompt: string,
    _options: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    if (this.latencyMs > 0) {
      await this.sleep(this.latencyMs);
    }

    const text = this.generateDeterministicResponse(prompt);
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(text.length / 4);

    return {
      text,
      tokenUsage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      finishReason: 'STOP',
    };
  }

  private generateDeterministicResponse(prompt: string): string {
    const hash = createHash('sha256').update(prompt).digest('hex');
    const shortHash = hash.substring(0, 8);

    return [
      '# Analysis Report',
      '',
      '## Summary',
      `This is a deterministic mock response generated from input hash \`${shortHash}\`.`,
      '',
      '## Findings',
      `- Finding A: Based on the provided context, the analysis identifies key patterns (ref: ${hash.substring(8, 16)}).`,
      `- Finding B: Additional observations derived from input characteristics (ref: ${hash.substring(16, 24)}).`,
      `- Finding C: Supplementary notes for completeness (ref: ${hash.substring(24, 32)}).`,
      '',
      '## Conclusion',
      `The analysis is complete. Mock provider hash: ${shortHash}.`,
    ].join('\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
