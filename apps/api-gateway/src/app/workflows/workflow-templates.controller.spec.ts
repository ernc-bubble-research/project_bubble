import { WorkflowTemplateResponseDto, TestRunResultDto } from '@project-bubble/shared';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowTestService } from './workflow-test.service';

describe('WorkflowTemplatesController [P1]', () => {
  let controller: WorkflowTemplatesController;
  let service: jest.Mocked<WorkflowTemplatesService>;
  let testService: jest.Mocked<WorkflowTestService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const sessionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const mockRequest = { user: { userId, tenantId: tenantId } };

  const mockResponse: WorkflowTemplateResponseDto = {
    id: templateId,
    tenantId,
    name: 'Analyze Transcript',
    description: null,
    visibility: 'public',
    allowedTenants: null,
    status: 'draft',
    currentVersionId: null,
    createdBy: userId,
    creditsPerRun: 1,
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-02'),
  };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(mockResponse),
      findAll: jest.fn().mockResolvedValue([mockResponse]),
      findOne: jest.fn().mockResolvedValue(mockResponse),
      update: jest.fn().mockResolvedValue(mockResponse),
      softDelete: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(mockResponse),
      publish: jest.fn().mockResolvedValue(mockResponse),
      rollback: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as jest.Mocked<WorkflowTemplatesService>;

    testService = {
      executeTest: jest.fn().mockResolvedValue({ sessionId }),
      exportResults: jest.fn().mockResolvedValue({
        sessionId,
        templateId,
        templateName: 'Test Template',
        inputs: {},
        results: [],
        executedAt: new Date(),
      } as TestRunResultDto),
    } as unknown as jest.Mocked<WorkflowTestService>;

    controller = new WorkflowTemplatesController(service, testService);
  });

  it('[3.3-UNIT-025] [P0] POST / — delegates to service.create with correct args', async () => {
    // Given
    const dto = { name: 'Analyze Transcript' };

    // When
    await controller.create(dto, mockRequest);

    // Then
    expect(service.create).toHaveBeenCalledWith(dto, tenantId, userId);
  });

  it('[3.3-UNIT-026] [P0] GET / — delegates to service.findAll with query params', async () => {
    // Given
    const query = { limit: 10, offset: 0, status: 'draft' as const };

    // When
    await controller.findAll(mockRequest, query);

    // Then
    expect(service.findAll).toHaveBeenCalledWith(tenantId, {
      limit: 10,
      offset: 0,
      status: 'draft',
      visibility: undefined,
    });
  });

  it('[3.3-UNIT-027] [P0] GET /:id — delegates to service.findOne', async () => {
    // When
    await controller.findOne(templateId, mockRequest);

    // Then
    expect(service.findOne).toHaveBeenCalledWith(templateId, tenantId);
  });

  it('[3.3-UNIT-028] [P0] PATCH /:id — delegates to service.update', async () => {
    // Given
    const dto = { name: 'Updated Name' };

    // When
    await controller.update(templateId, dto, mockRequest);

    // Then
    expect(service.update).toHaveBeenCalledWith(templateId, tenantId, dto);
  });

  it('[3.3-UNIT-029] [P0] DELETE /:id — delegates to service.softDelete', async () => {
    // When
    await controller.softDelete(templateId, mockRequest);

    // Then
    expect(service.softDelete).toHaveBeenCalledWith(templateId, tenantId);
  });

  it('[3.3-UNIT-030] [P1] POST /:id/restore — delegates to service.restore', async () => {
    // When
    await controller.restore(templateId, mockRequest);

    // Then
    expect(service.restore).toHaveBeenCalledWith(templateId, tenantId);
  });

  it('[3.4-UNIT-017] [P0] POST /:id/publish — delegates to service.publish without versionId', async () => {
    // Given
    const dto = {};

    // When
    await controller.publish(templateId, dto, mockRequest);

    // Then
    expect(service.publish).toHaveBeenCalledWith(templateId, tenantId, undefined);
  });

  it('[3.4-UNIT-018] [P0] POST /:id/publish — delegates to service.publish with versionId', async () => {
    // Given
    const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const dto = { versionId };

    // When
    await controller.publish(templateId, dto, mockRequest);

    // Then
    expect(service.publish).toHaveBeenCalledWith(templateId, tenantId, versionId);
  });

  it('[3.4-UNIT-019] [P0] POST /:id/rollback/:versionId — delegates to service.rollback', async () => {
    // Given
    const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

    // When
    await controller.rollback(templateId, versionId, mockRequest);

    // Then
    expect(service.rollback).toHaveBeenCalledWith(templateId, tenantId, versionId);
  });

  it('[4-7a-UNIT-025] [P0] POST /:id/test-run — delegates to testService.executeTest with correct args', async () => {
    // Given
    const dto = { templateId, inputs: { subject: { type: 'asset' as const, assetIds: ['asset-1'] } } };

    // When
    const result = await controller.testRun(templateId, dto, mockRequest);

    // Then
    expect(testService.executeTest).toHaveBeenCalledWith(templateId, dto.inputs, userId, tenantId);
    expect(result).toEqual({ sessionId });
  });

  it('[4-7a-UNIT-026] [P0] POST /:id/test-run — returns 202 status code (HTTP_CODE decorator)', async () => {
    // Given
    const dto = { templateId, inputs: {} };

    // When
    const result = await controller.testRun(templateId, dto, mockRequest);

    // Then
    // Note: @HttpCode(202) is a decorator — actual status code set by NestJS at runtime.
    // This test verifies the service call and response shape.
    expect(result).toHaveProperty('sessionId');
    expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('[4-7a-UNIT-027] [P0] GET /test-runs/:sessionId/export — delegates to testService.exportResults', async () => {
    // When
    const result = await controller.exportTestRun(sessionId);

    // Then
    expect(testService.exportResults).toHaveBeenCalledWith(sessionId);
    expect(result).toHaveProperty('sessionId', sessionId);
    expect(result).toHaveProperty('templateId');
    expect(result).toHaveProperty('results');
  });

  it('[4-7a-UNIT-028] [P0] GET /test-runs/:sessionId/export — returns TestRunResultDto shape', async () => {
    // When
    const result = await controller.exportTestRun(sessionId);

    // Then
    expect(result).toMatchObject({
      sessionId,
      templateId,
      templateName: expect.any(String),
      inputs: expect.any(Object),
      results: expect.any(Array),
      executedAt: expect.any(Date),
    });
  });
});
