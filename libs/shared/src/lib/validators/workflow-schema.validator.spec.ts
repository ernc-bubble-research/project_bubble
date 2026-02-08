import {
  validateWorkflowDefinition,
  ValidationResult,
} from './workflow-schema.validator';
import { WorkflowDefinition } from '../types/workflow-definition.interface';

/**
 * Helper to create a valid workflow definition for testing.
 * Tests modify specific fields to test validation rules.
 */
function createValidDefinition(): WorkflowDefinition {
  return {
    metadata: {
      name: 'analyze-transcript',
      description: 'Analyze a single interview transcript',
      version: 1,
      tags: ['qualitative', 'research'],
    },
    inputs: [
      {
        name: 'codebook',
        label: 'Codebook',
        role: 'context',
        source: ['asset', 'upload'],
        required: true,
        description: 'The coding framework',
      },
      {
        name: 'transcript',
        label: 'Interview Transcript',
        role: 'subject',
        source: ['upload'],
        required: true,
      },
    ],
    execution: {
      processing: 'parallel',
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      max_output_tokens: 8192,
    },
    knowledge: {
      enabled: true,
      query_strategy: 'auto',
      max_chunks: 10,
      similarity_threshold: 0.7,
    },
    prompt:
      'Analyze the transcript using the codebook.\n\n{codebook}\n\n{transcript}\n\n{knowledge_context}',
    output: {
      format: 'markdown',
      filename_template: 'analysis-{subject_name}-{timestamp}',
      sections: [
        { name: 'themes', label: 'Identified Themes', required: true },
        { name: 'quotes', label: 'Supporting Quotes', required: true },
        { name: 'emergent', label: 'Emergent Themes', required: false },
      ],
    },
  };
}

describe('validateWorkflowDefinition', () => {
  describe('Valid definitions', () => {
    it('[3.1-UNIT-001] [P0] Given a valid parallel markdown workflow, when validated, then result is valid with no errors', () => {
      // Given
      const definition = createValidDefinition();

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.1-UNIT-002] [P0] Given a valid batch workflow, when validated, then result is valid', () => {
      // Given
      const definition = createValidDefinition();
      definition.execution.processing = 'batch';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.1-UNIT-003] [P1] Given a valid JSON output workflow, when validated, then result is valid', () => {
      // Given
      const definition = createValidDefinition();
      definition.output.format = 'json';
      definition.output.sections = undefined;
      definition.output.json_schema = {
        type: 'object',
        properties: { themes: { type: 'array' } },
      };

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.1-UNIT-004] [P1] Given a workflow with knowledge disabled, when validated, then result is valid', () => {
      // Given
      const definition = createValidDefinition();
      definition.knowledge.enabled = false;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
    });

    it('[3.1-UNIT-005] [P1] Given a workflow with text source input, when validated, then result is valid', () => {
      // Given
      const definition = createValidDefinition();
      definition.inputs[0].source = ['asset', 'upload', 'text'];
      definition.inputs[0].text_config = {
        placeholder: 'Enter text...',
        max_length: 5000,
      };

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
    });
  });

  describe('Subject input validation', () => {
    it('[3.1-UNIT-006] [P0] Given a definition with 0 subject inputs, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.inputs = definition.inputs.filter((i) => i.role !== 'subject');

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Exactly 1 subject input is required, found 0',
      );
    });

    it('[3.1-UNIT-007] [P0] Given a definition with 2 subject inputs, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.inputs.push({
        name: 'extra_subject',
        label: 'Extra Subject',
        role: 'subject',
        source: ['upload'],
        required: true,
      });
      // Fix prompt to have all placeholders
      definition.prompt += '\n{extra_subject}';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Exactly 1 subject input is required, found 2');
    });
  });

  describe('Input name uniqueness', () => {
    it('[3.1-UNIT-008] [P0] Given duplicate input names, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.inputs.push({
        name: 'codebook',
        label: 'Duplicate Codebook',
        role: 'context',
        source: ['asset'],
        required: false,
      });

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Duplicate input names: codebook'),
        ]),
      );
    });
  });

  describe('Required field validation', () => {
    it('[3.1-UNIT-009] [P0] Given missing metadata, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition as any).metadata = undefined;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata is required');
    });

    it('[3.1-UNIT-010] [P0] Given missing metadata.name, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.metadata as any).name = '';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'metadata.name is required and must be a string',
      );
    });

    it('[3.1-UNIT-011] [P0] Given missing execution, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition as any).execution = undefined;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('execution is required');
    });

    it('[3.1-UNIT-012] [P0] Given missing execution.model, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.execution as any).model = '';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'execution.model is required and must be a string',
      );
    });

    it('[3.1-UNIT-013] [P0] Given missing prompt, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition as any).prompt = '';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'prompt is required and must be a string',
      );
    });
  });

  describe('Enum validation', () => {
    it('[3.1-UNIT-014] [P1] Given invalid processing mode, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.execution as any).processing = 'streaming';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('execution.processing must be one of'),
        ]),
      );
    });

    it('[3.1-UNIT-015] [P1] Given invalid output format, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.output as any).format = 'xml';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('output.format must be one of'),
        ]),
      );
    });

    it('[3.1-UNIT-016] [P1] Given invalid input role, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.inputs[0] as any).role = 'observer';

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('role must be one of'),
        ]),
      );
    });

    it('[3.1-UNIT-017] [P1] Given invalid source type, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      (definition.inputs[0] as any).source = ['database'];

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('invalid value "database"'),
        ]),
      );
    });
  });

  describe('Prompt variable validation', () => {
    it('[3.1-UNIT-018] [P0] Given prompt missing input placeholder, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.prompt = 'Analyze the transcript.\n{transcript}';
      // Missing {codebook}

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'prompt must contain placeholder {codebook}',
          ),
        ]),
      );
    });
  });

  describe('Output format validation', () => {
    it('[3.1-UNIT-019] [P0] Given markdown format without sections, when validated, then result is valid (sections optional)', () => {
      // Given — output.sections is now optional (party mode decision 2026-02-08: prompt defines structure)
      const definition = createValidDefinition();
      definition.output.format = 'markdown';
      definition.output.sections = undefined;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then — sections are no longer required for markdown format
      expect(result.valid).toBe(true);
    });

    it('[3.1-UNIT-019b] [P0] Given no output at all, when validated, then result is valid (output optional)', () => {
      // Given — output is now entirely optional
      const definition = createValidDefinition();
      (definition as any).output = undefined;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(true);
    });

    it('[3.1-UNIT-020] [P0] Given json format without json_schema, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.output.format = 'json';
      definition.output.sections = undefined;
      definition.output.json_schema = undefined;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'output.json_schema is required',
          ),
        ]),
      );
    });
  });

  describe('text_config validation', () => {
    it('[3.1-UNIT-021] [P2] Given text_config without text in source, when validated, then returns error', () => {
      // Given
      const definition = createValidDefinition();
      definition.inputs[0].source = ['asset'];
      definition.inputs[0].text_config = { placeholder: 'test' };

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('text_config is only valid when "text" is included in source'),
        ]),
      );
    });
  });

  describe('Multiple errors', () => {
    it('[3.1-UNIT-022] [P1] Given multiple issues, when validated, then returns all errors', () => {
      // Given
      const definition = {
        metadata: { name: '', description: '', version: 1 },
        inputs: [],
        execution: { processing: 'invalid' as any, model: '' },
        knowledge: { enabled: 'yes' as any },
        prompt: '',
        output: { format: 'xml' as any, filename_template: '' },
      } as unknown as WorkflowDefinition;

      // When
      const result = validateWorkflowDefinition(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});
