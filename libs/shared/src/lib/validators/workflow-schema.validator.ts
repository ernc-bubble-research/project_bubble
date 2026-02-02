import {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowInputRole,
  WorkflowInputSourceType,
  WorkflowProcessingMode,
  WorkflowOutputFormat,
} from '../types/workflow-definition.interface';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_ROLES: WorkflowInputRole[] = ['context', 'subject'];
const VALID_SOURCE_TYPES: WorkflowInputSourceType[] = ['asset', 'upload', 'text'];
const VALID_PROCESSING_MODES: WorkflowProcessingMode[] = ['parallel', 'batch'];
const VALID_OUTPUT_FORMATS: WorkflowOutputFormat[] = ['markdown', 'json'];

export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
): ValidationResult {
  const errors: string[] = [];

  // Validate metadata
  if (!definition.metadata) {
    errors.push('metadata is required');
  } else {
    if (!definition.metadata.name || typeof definition.metadata.name !== 'string') {
      errors.push('metadata.name is required and must be a string');
    }
    if (!definition.metadata.description || typeof definition.metadata.description !== 'string') {
      errors.push('metadata.description is required and must be a string');
    }
    if (definition.metadata.tags !== undefined && !Array.isArray(definition.metadata.tags)) {
      errors.push('metadata.tags must be an array of strings');
    }
  }

  // Validate inputs
  if (!definition.inputs || !Array.isArray(definition.inputs)) {
    errors.push('inputs is required and must be an array');
  } else {
    // Exactly 1 subject input
    const subjectInputs = definition.inputs.filter((i) => i.role === 'subject');
    if (subjectInputs.length === 0) {
      errors.push('Exactly 1 subject input is required, found 0');
    } else if (subjectInputs.length > 1) {
      errors.push(
        `Exactly 1 subject input is required, found ${subjectInputs.length}: ${subjectInputs.map((i) => i.name).join(', ')}`,
      );
    }

    // Unique input names
    const inputNames = definition.inputs.map((i) => i.name);
    const duplicates = inputNames.filter(
      (name, index) => inputNames.indexOf(name) !== index,
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate input names: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Validate each input
    for (const input of definition.inputs) {
      validateInput(input, errors);
    }
  }

  // Validate execution
  if (!definition.execution) {
    errors.push('execution is required');
  } else {
    if (!VALID_PROCESSING_MODES.includes(definition.execution.processing)) {
      errors.push(
        `execution.processing must be one of: ${VALID_PROCESSING_MODES.join(', ')}`,
      );
    }
    if (!definition.execution.model || typeof definition.execution.model !== 'string') {
      errors.push('execution.model is required and must be a string');
    }
  }

  // Validate knowledge
  if (!definition.knowledge) {
    errors.push('knowledge is required');
  } else {
    if (typeof definition.knowledge.enabled !== 'boolean') {
      errors.push('knowledge.enabled is required and must be a boolean');
    }
  }

  // Validate prompt
  if (!definition.prompt || typeof definition.prompt !== 'string') {
    errors.push('prompt is required and must be a string');
  } else if (definition.inputs && Array.isArray(definition.inputs)) {
    // Check that prompt contains {input_name} for each input
    for (const input of definition.inputs) {
      if (input.name && !definition.prompt.includes(`{${input.name}}`)) {
        errors.push(
          `prompt must contain placeholder {${input.name}} for input "${input.name}"`,
        );
      }
    }
  }

  // Validate output
  if (!definition.output) {
    errors.push('output is required');
  } else {
    if (!VALID_OUTPUT_FORMATS.includes(definition.output.format)) {
      errors.push(
        `output.format must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`,
      );
    }
    if (
      !definition.output.filename_template ||
      typeof definition.output.filename_template !== 'string'
    ) {
      errors.push('output.filename_template is required and must be a string');
    }

    // Conditional: sections required for markdown, json_schema for json
    if (definition.output.format === 'markdown') {
      if (
        !definition.output.sections ||
        !Array.isArray(definition.output.sections) ||
        definition.output.sections.length === 0
      ) {
        errors.push(
          'output.sections is required and must be a non-empty array when format is "markdown"',
        );
      } else {
        for (const section of definition.output.sections) {
          if (!section.name || typeof section.name !== 'string') {
            errors.push('Each output section must have a name (string)');
          }
          if (!section.label || typeof section.label !== 'string') {
            errors.push('Each output section must have a label (string)');
          }
          if (typeof section.required !== 'boolean') {
            errors.push('Each output section must have a required (boolean) field');
          }
        }
      }
    }

    if (definition.output.format === 'json') {
      if (
        !definition.output.json_schema ||
        typeof definition.output.json_schema !== 'object'
      ) {
        errors.push(
          'output.json_schema is required and must be an object when format is "json"',
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateInput(input: WorkflowInput, errors: string[]): void {
  if (!input.name || typeof input.name !== 'string') {
    errors.push('Each input must have a name (string)');
    return;
  }

  const prefix = `inputs[${input.name}]`;

  if (!input.label || typeof input.label !== 'string') {
    errors.push(`${prefix}.label is required and must be a string`);
  }
  if (!VALID_ROLES.includes(input.role)) {
    errors.push(`${prefix}.role must be one of: ${VALID_ROLES.join(', ')}`);
  }
  if (!input.source || !Array.isArray(input.source) || input.source.length === 0) {
    errors.push(`${prefix}.source is required and must be a non-empty array`);
  } else {
    for (const src of input.source) {
      if (!VALID_SOURCE_TYPES.includes(src)) {
        errors.push(
          `${prefix}.source contains invalid value "${src}". Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
        );
      }
    }
  }
  if (typeof input.required !== 'boolean') {
    errors.push(`${prefix}.required is required and must be a boolean`);
  }

  // text_config only makes sense when 'text' is in source
  if (input.text_config && (!input.source || !input.source.includes('text'))) {
    errors.push(
      `${prefix}.text_config is only valid when "text" is included in source`,
    );
  }
}
