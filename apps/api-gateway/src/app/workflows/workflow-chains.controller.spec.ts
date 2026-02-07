import { WorkflowChainResponseDto } from '@project-bubble/shared';
import { WorkflowChainsController } from './workflow-chains.controller';
import { WorkflowChainsService } from './workflow-chains.service';

describe('WorkflowChainsController [P1]', () => {
  let controller: WorkflowChainsController;
  let service: jest.Mocked<WorkflowChainsService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const chainId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const mockRequest = { user: { userId, tenantId: tenantId } };

  const mockResponse: WorkflowChainResponseDto = {
    id: chainId,
    tenantId,
    name: 'Test Chain',
    description: 'A test chain',
    visibility: 'public',
    allowedTenants: null,
    definition: {
      metadata: { name: 'Test', description: 'Test' },
      steps: [
        { workflow_id: '550e8400-e29b-41d4-a716-446655440001', alias: 'step1' },
        { workflow_id: '550e8400-e29b-41d4-a716-446655440002', alias: 'step2' },
      ],
    },
    status: 'draft',
    createdBy: userId,
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
    } as unknown as jest.Mocked<WorkflowChainsService>;

    controller = new WorkflowChainsController(service);
  });

  it('[3.6a-UNIT-014] [P0] POST / — delegates to service.create with correct args', async () => {
    // Given
    const dto = {
      name: 'Test Chain',
      definition: mockResponse.definition,
    };

    // When
    await controller.create(dto, mockRequest);

    // Then
    expect(service.create).toHaveBeenCalledWith(dto, tenantId, userId);
  });

  it('[3.6a-UNIT-015] [P0] GET / — delegates to service.findAll with query params', async () => {
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

  it('[3.6a-UNIT-016] [P0] GET /:id — delegates to service.findOne', async () => {
    // When
    await controller.findOne(chainId, mockRequest);

    // Then
    expect(service.findOne).toHaveBeenCalledWith(chainId, tenantId);
  });

  it('[3.6a-UNIT-017] [P0] PUT /:id — delegates to service.update', async () => {
    // Given
    const dto = { name: 'Updated Name' };

    // When
    await controller.update(chainId, dto, mockRequest);

    // Then
    expect(service.update).toHaveBeenCalledWith(chainId, tenantId, dto);
  });

  it('[3.6a-UNIT-018] [P0] DELETE /:id — delegates to service.softDelete', async () => {
    // When
    await controller.softDelete(chainId, mockRequest);

    // Then
    expect(service.softDelete).toHaveBeenCalledWith(chainId, tenantId);
  });

  it('[3.6a-UNIT-019] [P1] PATCH /:id/restore — delegates to service.restore', async () => {
    // When
    await controller.restore(chainId, mockRequest);

    // Then
    expect(service.restore).toHaveBeenCalledWith(chainId, tenantId);
  });

  it('[3.6a-UNIT-020] [P1] PATCH /:id/publish — delegates to service.publish', async () => {
    // When
    await controller.publish(chainId, mockRequest);

    // Then
    expect(service.publish).toHaveBeenCalledWith(chainId, tenantId);
  });
});
