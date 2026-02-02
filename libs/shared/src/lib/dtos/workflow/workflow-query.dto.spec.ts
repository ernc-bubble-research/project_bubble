import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListWorkflowTemplatesQueryDto } from './list-workflow-templates-query.dto';
import { CreateWorkflowVersionBodyDto } from './create-workflow-version-body.dto';
import { UpdateLlmModelDto } from './update-llm-model.dto';
import { PublishWorkflowTemplateDto } from './publish-workflow-template.dto';

describe('Workflow Query & Body DTOs [P1]', () => {
  describe('ListWorkflowTemplatesQueryDto', () => {
    it('[3.3-UNIT-038] [P0] Given valid query with all fields, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(ListWorkflowTemplatesQueryDto, {
        limit: 50,
        offset: 10,
        status: 'draft',
        visibility: 'public',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.3-UNIT-039] [P0] Given empty query (all defaults), when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(ListWorkflowTemplatesQueryDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.3-UNIT-040] [P1] Given invalid status enum, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(ListWorkflowTemplatesQueryDto, {
        status: 'deleted',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('[3.3-UNIT-041] [P1] Given limit exceeding max (>200), when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(ListWorkflowTemplatesQueryDto, {
        limit: 201,
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('[3.3-UNIT-042] [P1] Given negative offset, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(ListWorkflowTemplatesQueryDto, {
        offset: -1,
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'offset')).toBe(true);
    });
  });

  describe('CreateWorkflowVersionBodyDto', () => {
    it('[3.3-UNIT-042a] [P0] Given valid definition, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowVersionBodyDto, {
        definition: { metadata: { name: 'test' } },
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.3-UNIT-042b] [P0] Given missing definition, when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(CreateWorkflowVersionBodyDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'definition')).toBe(true);
    });
  });

  describe('UpdateLlmModelDto', () => {
    it('[3.3-UNIT-042c] [P1] Given valid partial update, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(UpdateLlmModelDto, {
        displayName: 'Updated Name',
        isActive: false,
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.3-UNIT-042d] [P1] Given empty body, when validated, then passes (all optional)', async () => {
      // Given
      const dto = plainToInstance(UpdateLlmModelDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });
  });

  describe('PublishWorkflowTemplateDto', () => {
    it('[3.4-UNIT-020] [P0] Given valid dto with versionId, when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(PublishWorkflowTemplateDto, {
        versionId: '550e8400-e29b-41d4-a716-446655440000',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.4-UNIT-021] [P0] Given empty dto (no versionId), when validated, then passes', async () => {
      // Given
      const dto = plainToInstance(PublishWorkflowTemplateDto, {});

      // When
      const errors = await validate(dto);

      // Then
      expect(errors).toHaveLength(0);
    });

    it('[3.4-UNIT-022] [P1] Given invalid versionId (not UUID), when validated, then returns error', async () => {
      // Given
      const dto = plainToInstance(PublishWorkflowTemplateDto, {
        versionId: 'not-a-uuid',
      });

      // When
      const errors = await validate(dto);

      // Then
      expect(errors.some((e) => e.property === 'versionId')).toBe(true);
    });
  });
});
