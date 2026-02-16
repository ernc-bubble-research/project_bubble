/**
 * 3-tier generation parameter merge utility.
 *
 * Resolution order (lowest → highest priority):
 *   Provider spec defaults → Model defaults → Workflow overrides
 *
 * Values are type-checked and clamped to spec min/max ranges.
 */
import { GenerationParamSpec } from './provider-registry.interface';
import { LLMGenerateOptions } from './llm.provider';
import { WorkflowExecution, GENERATION_PARAM_KEY_MAP } from '@project-bubble/shared';

/** Typed reference to shared map — cast values to keyof LLMGenerateOptions for type safety */
const SNAKE_TO_CAMEL = GENERATION_PARAM_KEY_MAP as Record<string, keyof LLMGenerateOptions>;

/** Defense-in-depth: only allow numbers and string arrays through the merge. */
function isValidParamType(value: unknown): boolean {
  if (typeof value === 'number' && !Number.isNaN(value)) return true;
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return true;
  return false;
}

/**
 * Merge three tiers of generation parameters into final LLMGenerateOptions.
 *
 * Resolution order (lowest to highest priority):
 *   1. Provider spec defaults (GenerationParamSpec[].default)
 *   2. Model defaults (LlmModelEntity.generationDefaults — camelCase keys)
 *   3. Workflow overrides (WorkflowExecution — snake_case keys)
 *
 * Rules:
 *   - Only params listed in providerSpecs are included in the output.
 *   - Unknown/unsupported keys from modelDefaults or workflowExecution are silently dropped.
 *   - Params without any value (no spec default, no model default, no workflow override) are omitted.
 *   - Null/undefined values are skipped (not treated as overrides).
 */
export function mergeGenerationParams(
  providerSpecs: GenerationParamSpec[],
  modelDefaults: Record<string, unknown> | null | undefined,
  workflowExecution: Partial<WorkflowExecution>,
): LLMGenerateOptions {
  const result: Record<string, unknown> = {};

  // Build a reverse map: camelCase → snake_case for looking up workflow execution fields
  const camelToSnake: Record<string, string> = {};
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    camelToSnake[camel] = snake;
  }

  for (const spec of providerSpecs) {
    const camelKey = spec.key; // spec keys are already camelCase
    const snakeKey = camelToSnake[camelKey];

    // Tier 1: provider spec default
    let value: unknown = spec.default;

    // Tier 2: model defaults (camelCase keys)
    if (modelDefaults && camelKey in modelDefaults) {
      const modelVal = modelDefaults[camelKey];
      if (modelVal !== null && modelVal !== undefined && isValidParamType(modelVal)) {
        value = modelVal;
      }
    }

    // Tier 3: workflow overrides (snake_case keys)
    if (snakeKey && snakeKey in workflowExecution) {
      const workflowVal = (workflowExecution as Record<string, unknown>)[snakeKey];
      if (workflowVal !== null && workflowVal !== undefined && isValidParamType(workflowVal)) {
        value = workflowVal;
      }
    }

    // Clamp numeric values to spec min/max ranges (defense-in-depth)
    if (typeof value === 'number') {
      if (spec.min !== undefined && (value as number) < spec.min) value = spec.min;
      if (spec.max !== undefined && (value as number) > spec.max) value = spec.max;
    }

    // Only include if we have a value (omit params with no defaults and no overrides)
    if (value !== undefined && value !== null) {
      result[camelKey] = value;
    }
  }

  return result as LLMGenerateOptions;
}
