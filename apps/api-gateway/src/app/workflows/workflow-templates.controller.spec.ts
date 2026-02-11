import { WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplatesService } from './workflow-templates.service';

describe('WorkflowTemplatesController [P1]', () => {
  let controller: WorkflowTemplatesController;
  let service: jest.Mocked<WorkflowTemplatesService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
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

    controller = new WorkflowTemplatesController(service);
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
});
