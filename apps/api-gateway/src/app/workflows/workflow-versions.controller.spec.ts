import { WorkflowVersionResponseDto } from '@project-bubble/shared';
import { WorkflowVersionsController } from './workflow-versions.controller';
import { WorkflowVersionsService } from './workflow-versions.service';

describe('WorkflowVersionsController [P1]', () => {
  let controller: WorkflowVersionsController;
  let service: jest.Mocked<WorkflowVersionsService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const mockRequest = { user: { userId, tenant_id: tenantId } };

  const mockVersionResponse: WorkflowVersionResponseDto = {
    id: versionId,
    tenantId,
    templateId,
    versionNumber: 1,
    definition: { metadata: { name: 'test' } },
    createdBy: userId,
    createdAt: new Date('2026-02-02'),
  };

  beforeEach(() => {
    service = {
      createVersion: jest.fn().mockResolvedValue(mockVersionResponse),
      findAllByTemplate: jest.fn().mockResolvedValue([mockVersionResponse]),
      findOne: jest.fn().mockResolvedValue(mockVersionResponse),
    } as unknown as jest.Mocked<WorkflowVersionsService>;

    controller = new WorkflowVersionsController(service);
  });

  it('[3.3-UNIT-031] [P0] POST / — delegates to service.createVersion with templateId from URL param', async () => {
    // Given
    const dto = { definition: { metadata: { name: 'test' } } };

    // When
    await controller.createVersion(templateId, dto, mockRequest);

    // Then
    expect(service.createVersion).toHaveBeenCalledWith(
      templateId,
      dto.definition,
      tenantId,
      userId,
    );
  });

  it('[3.3-UNIT-032] [P0] GET / — delegates to service.findAllByTemplate', async () => {
    // When
    await controller.findAllByTemplate(templateId, mockRequest);

    // Then
    expect(service.findAllByTemplate).toHaveBeenCalledWith(templateId, tenantId);
  });

  it('[3.3-UNIT-033] [P1] GET /:versionId — delegates to service.findOne', async () => {
    // When
    await controller.findOne(versionId, mockRequest);

    // Then
    expect(service.findOne).toHaveBeenCalledWith(versionId, tenantId);
  });
});
