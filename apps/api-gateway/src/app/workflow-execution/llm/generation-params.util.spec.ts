import { mergeGenerationParams } from './generation-params.util';
import { GenerationParamSpec } from './provider-registry.interface';
import { WorkflowExecution } from '@project-bubble/shared';

const GOOGLE_SPECS: GenerationParamSpec[] = [
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, default: 1.0 },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, default: 0.95 },
  { key: 'topK', label: 'Top K', type: 'number', min: 1, max: 100, default: 40 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 8192, default: 8192 },
  { key: 'stopSequences', label: 'Stop Sequences', type: 'string[]', maxItems: 5 },
];

const OPENAI_SPECS: GenerationParamSpec[] = [
  { key: 'temperature', label: 'Temperature', type: 'number', min: 0, max: 2, default: 1.0 },
  { key: 'topP', label: 'Top P', type: 'number', min: 0, max: 1, default: 1.0 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number', min: 1, max: 16384, default: 4096 },
  { key: 'stopSequences', label: 'Stop Sequences', type: 'string[]', maxItems: 4 },
];

describe('mergeGenerationParams', () => {
  it('[4-GP-UNIT-032] should return only spec defaults when no model or workflow overrides', () => {
    const result = mergeGenerationParams(GOOGLE_SPECS, null, { processing: 'parallel', model: 'uuid' });

    expect(result).toEqual({
      temperature: 1.0,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      // stopSequences has no default → omitted
    });
  });

  it('[4-GP-UNIT-033] should override spec defaults with model defaults', () => {
    const modelDefaults = { temperature: 0.3, topP: 0.8 };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(0.3);
    expect(result.topP).toBe(0.8);
    // Non-overridden params keep spec defaults
    expect(result.topK).toBe(40);
    expect(result.maxOutputTokens).toBe(8192);
  });

  it('[4-GP-UNIT-034] should override model defaults with workflow overrides', () => {
    const modelDefaults = { temperature: 0.3, topP: 0.8 };
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      temperature: 0.7,
      top_p: 0.5,
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, workflowExecution);

    expect(result.temperature).toBe(0.7);
    expect(result.topP).toBe(0.5);
    expect(result.topK).toBe(40); // spec default (no model or workflow override)
    expect(result.maxOutputTokens).toBe(8192); // spec default
  });

  it('[4-GP-UNIT-035] should handle full 3-tier merge correctly', () => {
    const modelDefaults = { temperature: 0.5, topK: 50, maxOutputTokens: 4096 };
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      temperature: 0.9,
      max_output_tokens: 2048,
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, workflowExecution);

    expect(result.temperature).toBe(0.9); // workflow override wins
    expect(result.topP).toBe(0.95); // spec default (nothing higher)
    expect(result.topK).toBe(50); // model override (no workflow override)
    expect(result.maxOutputTokens).toBe(2048); // workflow override wins over model
  });

  it('[4-GP-UNIT-036] should silently drop unknown keys from workflow overrides', () => {
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      temperature: 0.5,
    } as Partial<WorkflowExecution>;
    // Add an unknown key that isn't in the spec
    (workflowExecution as Record<string, unknown>)['unknown_param'] = 42;

    const result = mergeGenerationParams(GOOGLE_SPECS, null, workflowExecution);

    expect(result.temperature).toBe(0.5);
    expect(result).not.toHaveProperty('unknown_param');
    expect(result).not.toHaveProperty('unknownParam');
  });

  it('[4-GP-UNIT-037] should handle null modelDefaults gracefully', () => {
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      temperature: 0.6,
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, null, workflowExecution);

    expect(result.temperature).toBe(0.6);
    expect(result.topP).toBe(0.95); // spec default
    expect(result.topK).toBe(40); // spec default
    expect(result.maxOutputTokens).toBe(8192); // spec default
  });

  it('[4-GP-UNIT-038] should handle undefined modelDefaults gracefully', () => {
    const result = mergeGenerationParams(GOOGLE_SPECS, undefined, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(1.0);
    expect(result.topP).toBe(0.95);
  });

  it('[4-GP-UNIT-039] should perform correct snake_case→camelCase conversion', () => {
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      top_p: 0.7,
      top_k: 30,
      max_output_tokens: 1024,
      stop_sequences: ['END', 'STOP'],
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, null, workflowExecution);

    expect(result.topP).toBe(0.7);
    expect(result.topK).toBe(30);
    expect(result.maxOutputTokens).toBe(1024);
    expect(result.stopSequences).toEqual(['END', 'STOP']);
    // Verify snake_case keys are NOT in the output
    expect(result).not.toHaveProperty('top_p');
    expect(result).not.toHaveProperty('top_k');
    expect(result).not.toHaveProperty('max_output_tokens');
    expect(result).not.toHaveProperty('stop_sequences');
  });

  it('[4-GP-UNIT-040] should silently drop model defaults for unsupported params (e.g., topK on OpenAI)', () => {
    // OpenAI doesn't support topK
    const modelDefaults = { temperature: 0.5, topK: 50 };

    const result = mergeGenerationParams(OPENAI_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(0.5);
    expect(result).not.toHaveProperty('topK'); // OpenAI doesn't support topK
    expect(result.topP).toBe(1.0); // spec default
    expect(result.maxOutputTokens).toBe(4096); // spec default
  });

  it('[4-GP-UNIT-041] should omit params with no value across all tiers', () => {
    // stopSequences has no default in GOOGLE_SPECS and no model/workflow override
    const result = mergeGenerationParams(GOOGLE_SPECS, null, { processing: 'parallel', model: 'uuid' });

    expect(result).not.toHaveProperty('stopSequences');
  });

  it('[4-GP-UNIT-042] should include stopSequences when provided as model default', () => {
    const modelDefaults = { stopSequences: ['END'] };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.stopSequences).toEqual(['END']);
  });

  it('[4-GP-UNIT-043] should include stopSequences when provided as workflow override', () => {
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      stop_sequences: ['HALT', 'QUIT'],
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, null, workflowExecution);

    expect(result.stopSequences).toEqual(['HALT', 'QUIT']);
  });

  it('[4-GP-UNIT-044] should handle empty provider specs (returns empty options)', () => {
    const result = mergeGenerationParams([], { temperature: 0.5 }, { processing: 'parallel', model: 'uuid', temperature: 0.3 });

    expect(result).toEqual({});
  });

  it('[4-GP-UNIT-045] should skip null values in model defaults (not treat as override)', () => {
    const modelDefaults = { temperature: null, topP: 0.8 };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults as Record<string, unknown>, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(1.0); // spec default (null was skipped)
    expect(result.topP).toBe(0.8); // model override
  });

  it('[4-GP-UNIT-046] should skip null values in workflow overrides (not treat as override)', () => {
    const modelDefaults = { temperature: 0.5 };
    const workflowExecution = {
      processing: 'parallel' as const,
      model: 'uuid',
      temperature: null,
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, workflowExecution as unknown as Partial<WorkflowExecution>);

    expect(result.temperature).toBe(0.5); // model default (null workflow was skipped)
  });

  it('[4-GP-UNIT-048] should skip model defaults with invalid type (string for number param)', () => {
    const modelDefaults = { temperature: 'not a number', topP: 0.8 } as Record<string, unknown>;

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(1.0); // fell back to spec default (string was skipped)
    expect(result.topP).toBe(0.8); // valid number was kept
  });

  it('[4-GP-UNIT-049] should skip model defaults with invalid type (object for number param)', () => {
    const modelDefaults = { temperature: { nested: true } } as Record<string, unknown>;

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(1.0); // fell back to spec default
  });

  it('[4-GP-UNIT-050] should skip model defaults with NaN value', () => {
    const modelDefaults = { temperature: NaN } as Record<string, unknown>;

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(1.0); // fell back to spec default (NaN was skipped)
  });

  it('[4-GP-UNIT-056] should clamp model default above spec max to max', () => {
    const modelDefaults = { temperature: 5.0 }; // spec max is 2

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    expect(result.temperature).toBe(2); // clamped to max
  });

  it('[4-GP-UNIT-057] should clamp workflow override below spec min to min', () => {
    const workflowExecution: Partial<WorkflowExecution> = {
      processing: 'parallel',
      model: 'uuid',
      temperature: -1, // spec min is 0
      top_k: -5, // spec min is 1
    };

    const result = mergeGenerationParams(GOOGLE_SPECS, null, workflowExecution);

    expect(result.temperature).toBe(0); // clamped to min
    expect(result.topK).toBe(1); // clamped to min
  });

  it('[4-GP-UNIT-058] should not clamp string array values (no min/max for arrays)', () => {
    const modelDefaults = { stopSequences: ['A', 'B', 'C', 'D', 'E', 'F'] };

    const result = mergeGenerationParams(GOOGLE_SPECS, modelDefaults, { processing: 'parallel', model: 'uuid' });

    // string arrays are not numeric — clamping does not apply
    expect(result.stopSequences).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
});
