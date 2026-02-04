import { validateChainSchema } from './chain-schema.validator';
import { ChainDefinition } from '../types/workflow-chain.interface';

describe('[P1] chain-schema.validator', () => {
  const createValidChain = (): ChainDefinition => ({
    metadata: {
      name: 'Test Chain',
      description: 'A test chain for validation',
    },
    steps: [
      {
        workflow_id: '550e8400-e29b-41d4-a716-446655440001',
        alias: 'step1',
      },
      {
        workflow_id: '550e8400-e29b-41d4-a716-446655440002',
        alias: 'step2',
        input_mapping: {
          reports: {
            from_step: 'step1',
            from_output: 'outputs',
          },
        },
      },
    ],
  });

  describe('valid chain definition', () => {
    it('[3.6a-VAL-001] should pass for a valid chain definition', () => {
      // Given
      const definition = createValidChain();

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.6a-VAL-001a] should pass with empty description', () => {
      // Given
      const definition = createValidChain();
      definition.metadata.description = '';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.6a-VAL-001b] should pass with from_input source', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        data: { from_input: 'user_data' },
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('[3.6a-VAL-001c] should pass with from_chain_config source', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        format: { from_chain_config: true, value: 'executive-summary' },
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('metadata validation', () => {
    it('[3.6a-VAL-002] should fail when metadata.name is missing', () => {
      // Given
      const definition = createValidChain();
      delete (definition.metadata as Partial<typeof definition.metadata>).name;

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.name is required and must be a non-empty string');
    });

    it('[3.6a-VAL-002a] should fail when metadata.name is empty', () => {
      // Given
      const definition = createValidChain();
      definition.metadata.name = '';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.name is required and must be a non-empty string');
    });

    it('[3.6a-VAL-002b] should fail when metadata.name is whitespace only', () => {
      // Given
      const definition = createValidChain();
      definition.metadata.name = '   ';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.name cannot be empty or whitespace only');
    });

    it('[3.6a-VAL-002c] should fail when metadata is missing', () => {
      // Given
      const definition = createValidChain();
      delete (definition as Partial<ChainDefinition>).metadata;

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata is required');
    });

    it('[3.6a-VAL-002d] should fail when metadata.description is missing', () => {
      // Given
      const definition = createValidChain();
      delete (definition.metadata as Partial<typeof definition.metadata>).description;

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('metadata.description is required (can be empty string)');
    });
  });

  describe('steps count validation', () => {
    it('[3.6a-VAL-003] should fail when steps has fewer than 2 items', () => {
      // Given
      const definition = createValidChain();
      definition.steps = [definition.steps[0]];

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps must have at least 2 steps, found 1');
    });

    it('[3.6a-VAL-003a] should fail when steps is empty', () => {
      // Given
      const definition = createValidChain();
      definition.steps = [];

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps must have at least 2 steps, found 0');
    });

    it('[3.6a-VAL-003b] should fail when steps is not an array', () => {
      // Given
      const definition = createValidChain();
      (definition as { steps: unknown }).steps = 'not an array';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps is required and must be an array');
    });
  });

  describe('alias validation', () => {
    it('[3.6a-VAL-004] should fail when alias is duplicated', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].alias = 'step1'; // Same as step[0]

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
    });

    it('[3.6a-VAL-004a] should fail when alias is missing', () => {
      // Given
      const definition = createValidChain();
      delete (definition.steps[0] as Partial<typeof definition.steps[0]>).alias;

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps[0].alias is required and must be a non-empty string');
    });

    it('[3.6a-VAL-004b] should fail when alias is empty string', () => {
      // Given
      const definition = createValidChain();
      definition.steps[0].alias = '';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps[0].alias is required and must be a non-empty string');
    });
  });

  describe('first step input_mapping validation', () => {
    it('[3.6a-VAL-005] should fail when first step has non-empty input_mapping', () => {
      // Given
      const definition = createValidChain();
      definition.steps[0].input_mapping = {
        data: { from_input: 'user_data' },
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'steps[0].input_mapping must be empty or undefined for the first step (inputs come from user at runtime)',
      );
    });

    it('[3.6a-VAL-005a] should pass when first step has empty input_mapping object', () => {
      // Given
      const definition = createValidChain();
      definition.steps[0].input_mapping = {};

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(true);
    });
  });

  describe('from_step reference validation', () => {
    it('[3.6a-VAL-006] should fail when from_step references non-existent alias', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        data: { from_step: 'nonexistent', from_output: 'outputs' },
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
    });

    it('[3.6a-VAL-007] should fail when from_step references a later step (forward reference)', () => {
      // Given
      const definition: ChainDefinition = {
        metadata: { name: 'Test', description: 'Test' },
        steps: [
          { workflow_id: '550e8400-e29b-41d4-a716-446655440001', alias: 'step1' },
          {
            workflow_id: '550e8400-e29b-41d4-a716-446655440002',
            alias: 'step2',
            input_mapping: {
              data: { from_step: 'step3', from_output: 'outputs' }, // Forward reference
            },
          },
          { workflow_id: '550e8400-e29b-41d4-a716-446655440003', alias: 'step3' },
        ],
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('step3') && e.includes('must reference a previous step'))).toBe(true);
    });

    it('[3.6a-VAL-006a] should fail when from_output is not "outputs"', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        data: { from_step: 'step1', from_output: 'invalid' as 'outputs' },
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('from_output must be "outputs"'))).toBe(true);
    });
  });

  describe('UUID validation', () => {
    it('[3.6a-VAL-008] should fail when workflow_id is not a valid UUID', () => {
      // Given
      const definition = createValidChain();
      definition.steps[0].workflow_id = 'not-a-uuid';

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps[0].workflow_id must be a valid UUID, got "not-a-uuid"');
    });

    it('[3.6a-VAL-008a] should fail when workflow_id is missing', () => {
      // Given
      const definition = createValidChain();
      delete (definition.steps[0] as Partial<typeof definition.steps[0]>).workflow_id;

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('steps[0].workflow_id is required and must be a string');
    });
  });

  describe('input_mapping source validation', () => {
    it('[3.6a-VAL-009] should fail when input_mapping has no source type', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        data: {}, // No source specified
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must specify at least one source type'))).toBe(true);
    });

    it('[3.6a-VAL-009a] should fail when from_chain_config is true but value is missing', () => {
      // Given
      const definition = createValidChain();
      definition.steps[1].input_mapping = {
        format: { from_chain_config: true }, // Missing value
      };

      // When
      const result = validateChainSchema(definition);

      // Then
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('value is required when from_chain_config is true'))).toBe(true);
    });
  });
});
