import { ChainDefinition, ChainStep } from '../types/workflow-chain.interface';
import { ValidationResult } from './workflow-schema.validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates chain definition schema structure.
 * This is schema-only validation (no DB access required).
 * Semantic validation (workflow existence, accessibility) is done in WorkflowChainsService.
 *
 * Schema validation rules:
 * - metadata.name required, non-empty
 * - metadata.description required (can be empty string)
 * - steps array required, minimum 2 steps
 * - Each step must have workflow_id (valid UUID format) and alias (non-empty)
 * - Alias must be unique across all steps
 * - First step (index 0) must NOT have input_mapping (or must be empty/undefined)
 * - from_step references must point to previous step aliases (not forward references)
 * - from_output must be "outputs" if specified
 */
export function validateChainSchema(
  definition: ChainDefinition,
): ValidationResult {
  const errors: string[] = [];

  // Validate metadata
  if (!definition.metadata) {
    errors.push('metadata is required');
  } else {
    if (!definition.metadata.name || typeof definition.metadata.name !== 'string') {
      errors.push('metadata.name is required and must be a non-empty string');
    } else if (definition.metadata.name.trim().length === 0) {
      errors.push('metadata.name cannot be empty or whitespace only');
    }

    if (definition.metadata.description === undefined || definition.metadata.description === null) {
      errors.push('metadata.description is required (can be empty string)');
    } else if (typeof definition.metadata.description !== 'string') {
      errors.push('metadata.description must be a string');
    }
  }

  // Validate steps
  if (!definition.steps || !Array.isArray(definition.steps)) {
    errors.push('steps is required and must be an array');
  } else if (definition.steps.length < 2) {
    errors.push(`steps must have at least 2 steps, found ${definition.steps.length}`);
  } else {
    // Collect all aliases for uniqueness check and forward reference validation
    const aliases: string[] = [];
    const aliasSet = new Set<string>();

    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      const prefix = `steps[${i}]`;

      // Validate workflow_id
      if (!step.workflow_id || typeof step.workflow_id !== 'string') {
        errors.push(`${prefix}.workflow_id is required and must be a string`);
      } else if (!UUID_REGEX.test(step.workflow_id)) {
        errors.push(`${prefix}.workflow_id must be a valid UUID, got "${step.workflow_id}"`);
      }

      // Validate alias
      if (!step.alias || typeof step.alias !== 'string') {
        errors.push(`${prefix}.alias is required and must be a non-empty string`);
      } else if (step.alias.trim().length === 0) {
        errors.push(`${prefix}.alias cannot be empty or whitespace only`);
      } else {
        // Check for duplicate alias
        if (aliasSet.has(step.alias)) {
          errors.push(`${prefix}.alias "${step.alias}" is duplicate (aliases must be unique)`);
        }
        aliasSet.add(step.alias);
        aliases.push(step.alias);
      }

      // First step must NOT have input_mapping
      if (i === 0 && step.input_mapping) {
        const mappingKeys = Object.keys(step.input_mapping);
        if (mappingKeys.length > 0) {
          errors.push(`${prefix}.input_mapping must be empty or undefined for the first step (inputs come from user at runtime)`);
        }
      }

      // Validate input_mapping for subsequent steps
      if (i > 0 && step.input_mapping) {
        validateInputMapping(step.input_mapping, aliases.slice(0, i), prefix, errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates input_mapping structure.
 * - from_step must reference a previous step's alias
 * - from_output must be "outputs" if specified
 */
function validateInputMapping(
  inputMapping: NonNullable<ChainStep['input_mapping']>,
  previousAliases: string[],
  stepPrefix: string,
  errors: string[],
): void {
  for (const [inputName, source] of Object.entries(inputMapping)) {
    const prefix = `${stepPrefix}.input_mapping.${inputName}`;

    // Validate from_step references
    if (source.from_step !== undefined) {
      if (typeof source.from_step !== 'string') {
        errors.push(`${prefix}.from_step must be a string`);
      } else if (!previousAliases.includes(source.from_step)) {
        errors.push(
          `${prefix}.from_step "${source.from_step}" must reference a previous step alias. Available aliases: ${previousAliases.length > 0 ? previousAliases.join(', ') : '(none)'}`,
        );
      }

      // from_output validation
      if (source.from_output !== undefined && source.from_output !== 'outputs') {
        errors.push(`${prefix}.from_output must be "outputs" if specified, got "${source.from_output}"`);
      }
    }

    // Validate from_chain_config with value
    if (source.from_chain_config === true) {
      if (source.value === undefined) {
        errors.push(`${prefix}.value is required when from_chain_config is true`);
      }
    }

    // Validate from_input is a string
    if (source.from_input !== undefined && typeof source.from_input !== 'string') {
      errors.push(`${prefix}.from_input must be a string`);
    }

    // At least one source type must be specified
    const hasSource =
      source.from_step !== undefined ||
      source.from_input !== undefined ||
      source.from_chain_config === true;
    if (!hasSource) {
      errors.push(
        `${prefix} must specify at least one source type: from_step, from_input, or from_chain_config`,
      );
    }
  }
}
