import {
  WorkflowTemplateStatus,
  WorkflowVisibility,
} from '@project-bubble/db-layer';
import { WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowCatalogController } from './workflow-catalog.controller';
import { WorkflowTemplatesService } from './workflow-templates.service';

describe('WorkflowCatalogController [P1]', () => {
  let controller: WorkflowCatalogController;
  let service: jest.Mocked<Pick<WorkflowTemplatesService, 'findPublished'>>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockResponse: WorkflowTemplateResponseDto = {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    tenantId,
    name: 'Analyze Transcript',
    description: 'Analyze interview transcripts',
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    status: WorkflowTemplateStatus.PUBLISHED,
    currentVersionId: null,
    createdBy: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-02'),
  };

  beforeEach(() => {
    service = {
      findPublished: jest.fn(),
    };

    controller = new WorkflowCatalogController(
      service as unknown as WorkflowTemplatesService,
    );
  });

  describe('findPublished', () => {
    it('[3.5-UNIT-006] [P0] Given authenticated tenant user, when GET / is called, then delegates to service.findPublished with tenantId from JWT', async () => {
      // Given
      service.findPublished.mockResolvedValue([mockResponse]);
      const req = { user: { tenant_id: tenantId } };

      // When
      const result = await controller.findPublished(req, {});

      // Then
      expect(result).toEqual([mockResponse]);
      expect(service.findPublished).toHaveBeenCalledWith(tenantId, {
        limit: undefined,
        offset: undefined,
      });
    });

    it('[3.5-UNIT-007] [P1] Given query params, when GET / is called with limit and offset, then passes query params to service', async () => {
      // Given
      service.findPublished.mockResolvedValue([]);
      const req = { user: { tenant_id: tenantId } };

      // When
      await controller.findPublished(req, { limit: 20, offset: 10 });

      // Then
      expect(service.findPublished).toHaveBeenCalledWith(tenantId, {
        limit: 20,
        offset: 10,
      });
    });
  });
});
