import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateWorkflowTemplateDto } from './create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from './update-workflow-template.dto';
import { CreateWorkflowVersionDto } from './create-workflow-version.dto';
import { CreateWorkflowChainDto } from './create-workflow-chain.dto';
import { CreateLlmModelDto } from './create-llm-model.dto';

describe('Workflow DTOs', () => {
  describe('CreateWorkflowTemplateDto', () => {
    it('[3.1-UNIT-023] [P0] Given valid data, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowTemplateDto, {
        name: 'Analyze Transcript',
        description: 'Analyzes interview transcripts',
        visibility: 'public',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-024] [P0] Given missing name, when validated, then returns errors', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowTemplateDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('[3.1-UNIT-025] [P1] Given name exceeding max length, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowTemplateDto, {
        name: 'a'.repeat(256),
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('[3.1-UNIT-026] [P1] Given invalid visibility enum, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowTemplateDto, {
        name: 'Test',
        visibility: 'internal',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'visibility')).toBe(true);
    });

    it('[3.1-UNIT-027] [P2] Given only required fields, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowTemplateDto, {
        name: 'Minimal Workflow',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateWorkflowTemplateDto', () => {
    it('[3.1-UNIT-028] [P1] Given all optional fields, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(UpdateWorkflowTemplateDto, {
        name: 'Updated Name',
        status: 'published',
        visibility: 'private',
        allowedTenants: ['550e8400-e29b-41d4-a716-446655440000'],
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-029] [P1] Given empty body (partial update), when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(UpdateWorkflowTemplateDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-030] [P1] Given invalid status enum, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(UpdateWorkflowTemplateDto, {
        status: 'deleted',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('[3.1-UNIT-031] [P2] Given invalid UUID in allowedTenants, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(UpdateWorkflowTemplateDto, {
        allowedTenants: ['not-a-uuid'],
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'allowedTenants')).toBe(true);
    });
  });

  describe('CreateWorkflowVersionDto', () => {
    it('[3.1-UNIT-032] [P0] Given valid data, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowVersionDto, {
        templateId: '550e8400-e29b-41d4-a716-446655440000',
        definition: { metadata: { name: 'test' } },
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-033] [P0] Given missing templateId, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowVersionDto, {
        definition: { metadata: { name: 'test' } },
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'templateId')).toBe(true);
    });

    it('[3.1-UNIT-034] [P0] Given missing definition, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowVersionDto, {
        templateId: '550e8400-e29b-41d4-a716-446655440000',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'definition')).toBe(true);
    });
  });

  describe('CreateWorkflowChainDto', () => {
    it('[3.1-UNIT-035] [P0] Given valid data, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowChainDto, {
        name: 'Full Analysis Chain',
        description: 'Analyze then consolidate',
        definition: { steps: [] },
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-036] [P0] Given missing name, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowChainDto, {
        definition: { steps: [] },
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('[3.1-UNIT-037] [P0] Given missing definition, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowChainDto, {
        name: 'Test Chain',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'definition')).toBe(true);
    });
  });

  describe('CreateLlmModelDto', () => {
    it('[3.1-UNIT-038] [P0] Given valid data, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-039] [P0] Given missing required fields, when validated, then returns errors', async () => {
      // Given
      const dto = plainToInstance(CreateLlmModelDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.length).toBeGreaterThanOrEqual(5);
      const props = errors.map((e) => e.property);
      expect(props).toContain('providerKey');
      expect(props).toContain('modelId');
      expect(props).toContain('displayName');
      expect(props).toContain('contextWindow');
      expect(props).toContain('maxOutputTokens');
    });

    it('[3.1-UNIT-040] [P1] Given optional cost fields, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'vertex',
        modelId: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash (Vertex)',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        isActive: true,
        costPer1kInput: '0.000150',
        costPer1kOutput: '0.000600',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.1-UNIT-041] [P1] Given providerKey exceeding max length, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'a'.repeat(51),
        modelId: 'test',
        displayName: 'Test',
        contextWindow: 1000,
        maxOutputTokens: 1000,
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'providerKey')).toBe(true);
    });

    it('[4-GP-UNIT-051] Given valid generationDefaults, when validated, then passes', async () => {
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        generationDefaults: { temperature: 0.7, topP: 0.9 },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('[4-GP-UNIT-052] Given generationDefaults with stopSequences string array, when validated, then passes', async () => {
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        generationDefaults: { stopSequences: ['END', 'STOP'] },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('[4-GP-UNIT-053] Given generationDefaults with unknown key, when validated, then returns error', async () => {
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        generationDefaults: { temperature: 0.7, unknownParam: 42 },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'generationDefaults')).toBe(true);
    });

    it('[4-GP-UNIT-054] Given generationDefaults with string value for number param, when validated, then returns error', async () => {
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        generationDefaults: { temperature: 'not a number' },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'generationDefaults')).toBe(true);
    });

    it('[4-GP-UNIT-055] Given generationDefaults with NaN value, when validated, then returns error', async () => {
      const dto = plainToInstance(CreateLlmModelDto, {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        generationDefaults: { temperature: NaN },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'generationDefaults')).toBe(true);
    });
  });
});
