import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  SearchKnowledgeDto,
  CreateValidatedInsightDto,
  ListInsightsQueryDto,
} from '@project-bubble/shared';

describe('SearchKnowledgeDto validation [2.3-UNIT-003] [P2]', () => {
  it('[2.3-UNIT-003a] should reject empty query', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('query');
  });

  it('[2.3-UNIT-003b] should reject missing query', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('[2.3-UNIT-003c] should accept valid query with defaults', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: 'test search' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('[2.3-UNIT-003d] should reject limit > 50', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: 'test', limit: 51 });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
  });

  it('[2.3-UNIT-003e] should reject limit < 1', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: 'test', limit: 0 });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
  });

  it('[2.3-UNIT-003f] should reject similarityThreshold > 1', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: 'test', similarityThreshold: 1.5 });
    const errors = await validate(dto);
    const thresholdError = errors.find((e) => e.property === 'similarityThreshold');
    expect(thresholdError).toBeDefined();
  });

  it('[2.3-UNIT-003g] should reject similarityThreshold < 0', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, { query: 'test', similarityThreshold: -0.1 });
    const errors = await validate(dto);
    const thresholdError = errors.find((e) => e.property === 'similarityThreshold');
    expect(thresholdError).toBeDefined();
  });

  it('[2.3-UNIT-003h] should accept valid full request', async () => {
    const dto = plainToInstance(SearchKnowledgeDto, {
      query: 'trust themes',
      limit: 20,
      similarityThreshold: 0.5,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('ListInsightsQueryDto validation [2.4-UNIT-008] [P2]', () => {
  it('[2.4-UNIT-008a] should accept empty query (all optional)', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('[2.4-UNIT-008b] should accept valid limit and offset', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, { limit: 50, offset: 10 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('[2.4-UNIT-008c] should reject limit > 100', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, { limit: 101 });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
  });

  it('[2.4-UNIT-008d] should reject limit < 1', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, { limit: 0 });
    const errors = await validate(dto);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
  });

  it('[2.4-UNIT-008e] should reject negative offset', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, { offset: -1 });
    const errors = await validate(dto);
    const offsetError = errors.find((e) => e.property === 'offset');
    expect(offsetError).toBeDefined();
  });

  it('[2.4-UNIT-008f] should transform string values to numbers', async () => {
    const dto = plainToInstance(ListInsightsQueryDto, { limit: '20', offset: '5' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.offset).toBe(5);
  });
});

describe('CreateValidatedInsightDto validation [2.4-UNIT-007] [P2]', () => {
  it('[2.4-UNIT-007a] should accept valid insight with all fields', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Trust was confirmed as the dominant theme.',
      sourceType: 'report_feedback',
      sourceRunId: '550e8400-e29b-41d4-a716-446655440000',
      sourceReportId: '550e8400-e29b-41d4-a716-446655440001',
      originalContent: 'Trust was NOT the dominant theme.',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('[2.4-UNIT-007b] should accept valid insight with only required fields', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Minimal insight.',
      sourceType: 'manual_entry',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('[2.4-UNIT-007c] should reject empty content', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: '',
      sourceType: 'report_feedback',
    });
    const errors = await validate(dto);
    const contentError = errors.find((e) => e.property === 'content');
    expect(contentError).toBeDefined();
  });

  it('[2.4-UNIT-007d] should reject missing content', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      sourceType: 'report_feedback',
    });
    const errors = await validate(dto);
    const contentError = errors.find((e) => e.property === 'content');
    expect(contentError).toBeDefined();
  });

  it('[2.4-UNIT-007e] should reject missing sourceType', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Test insight.',
    });
    const errors = await validate(dto);
    const sourceTypeError = errors.find((e) => e.property === 'sourceType');
    expect(sourceTypeError).toBeDefined();
  });

  it('[2.4-UNIT-007f] should reject invalid sourceType enum value', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Test insight.',
      sourceType: 'invalid_type',
    });
    const errors = await validate(dto);
    const sourceTypeError = errors.find((e) => e.property === 'sourceType');
    expect(sourceTypeError).toBeDefined();
  });

  it('[2.4-UNIT-007g] should reject non-UUID sourceRunId', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Test insight.',
      sourceType: 'report_feedback',
      sourceRunId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    const runIdError = errors.find((e) => e.property === 'sourceRunId');
    expect(runIdError).toBeDefined();
  });

  it('[2.4-UNIT-007h] should reject non-UUID sourceReportId', async () => {
    const dto = plainToInstance(CreateValidatedInsightDto, {
      content: 'Test insight.',
      sourceType: 'report_feedback',
      sourceReportId: 'not-a-uuid',
    });
    const errors = await validate(dto);
    const reportIdError = errors.find((e) => e.property === 'sourceReportId');
    expect(reportIdError).toBeDefined();
  });

  it('[2.4-UNIT-007i] should accept all three sourceType enum values', async () => {
    for (const type of ['report_feedback', 'assumption_correction', 'manual_entry']) {
      const dto = plainToInstance(CreateValidatedInsightDto, {
        content: 'Test insight.',
        sourceType: type,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
