import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WorkflowChainService } from './workflow-chain.service';
import type {
  WorkflowChainResponseDto,
  CreateWorkflowChainDto,
  UpdateWorkflowChainDto,
} from '@project-bubble/shared';

describe('WorkflowChainService [P0]', () => {
  let service: WorkflowChainService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/admin/workflow-chains';

  const mockChainResponse: WorkflowChainResponseDto = {
    id: 'chain-id-123',
    tenantId: 'tenant-id-456',
    name: 'Test Chain',
    description: 'A test chain',
    visibility: 'public',
    allowedTenants: null,
    definition: {
      metadata: { name: 'Test Chain', description: 'A test chain' },
      steps: [
        { workflow_id: 'wf-1', alias: 'step_0' },
        { workflow_id: 'wf-2', alias: 'step_1' },
      ],
    },
    status: 'draft',
    createdBy: 'user-id-789',
    createdAt: '2026-02-04T00:00:00.000Z',
    updatedAt: '2026-02-04T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WorkflowChainService],
    });
    service = TestBed.inject(WorkflowChainService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('create', () => {
    it('[3.6b-UNIT-001] [P0] Given valid DTO, when create is called, then POST request is sent to correct endpoint', () => {
      // Given
      const createDto: CreateWorkflowChainDto = {
        name: 'Test Chain',
        description: 'A test chain',
        definition: {
          metadata: { name: 'Test Chain', description: 'A test chain' },
          steps: [
            { workflow_id: 'wf-1', alias: 'step_0' },
            { workflow_id: 'wf-2', alias: 'step_1' },
          ],
        },
      };

      // When
      service.create(createDto).subscribe((result) => {
        // Then
        expect(result).toEqual(mockChainResponse);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createDto);
      req.flush(mockChainResponse);
    });
  });

  describe('getById', () => {
    it('[3.6b-UNIT-002] [P0] Given chain ID, when getById is called, then returns chain response', () => {
      // Given
      const chainId = 'chain-id-123';

      // When
      service.getById(chainId).subscribe((result) => {
        // Then
        expect(result).toEqual(mockChainResponse);
      });

      const req = httpMock.expectOne(`${baseUrl}/${chainId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockChainResponse);
    });
  });

  describe('update', () => {
    it('[3.6b-UNIT-003] [P0] Given chain ID and DTO, when update is called, then PUT request is sent to correct endpoint', () => {
      // Given
      const chainId = 'chain-id-123';
      const updateDto: UpdateWorkflowChainDto = {
        name: 'Updated Chain Name',
      };

      // When
      service.update(chainId, updateDto).subscribe((result) => {
        // Then
        expect(result).toEqual(mockChainResponse);
      });

      const req = httpMock.expectOne(`${baseUrl}/${chainId}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateDto);
      req.flush(mockChainResponse);
    });
  });

  describe('publish', () => {
    it('[3.6b-UNIT-004] [P0] Given chain ID, when publish is called, then PATCH request is sent to publish endpoint', () => {
      // Given
      const chainId = 'chain-id-123';
      const publishedChain = { ...mockChainResponse, status: 'published' };

      // When
      service.publish(chainId).subscribe((result) => {
        // Then
        expect(result).toEqual(publishedChain);
      });

      const req = httpMock.expectOne(`${baseUrl}/${chainId}/publish`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush(publishedChain);
    });
  });

  describe('getAll', () => {
    it('[3.6b-UNIT-004a] [P1] Given no params, when getAll is called, then GET request is sent without query params', () => {
      // Given / When
      service.getAll().subscribe((result) => {
        // Then
        expect(result).toEqual([mockChainResponse]);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush([mockChainResponse]);
    });

    it('[3.6b-UNIT-004b] [P1] Given params, when getAll is called, then GET request includes query params', () => {
      // Given
      const params = { limit: 10, offset: 5, status: 'draft' as const };

      // When
      service.getAll(params).subscribe((result) => {
        // Then
        expect(result).toEqual([mockChainResponse]);
      });

      const req = httpMock.expectOne((request) => request.url === baseUrl);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('10');
      expect(req.request.params.get('offset')).toBe('5');
      expect(req.request.params.get('status')).toBe('draft');
      req.flush([mockChainResponse]);
    });
  });

  describe('delete', () => {
    it('[3.6b-UNIT-004c] [P1] Given chain ID, when delete is called, then DELETE request is sent', () => {
      // Given
      const chainId = 'chain-id-123';

      // When
      service.delete(chainId).subscribe();

      const req = httpMock.expectOne(`${baseUrl}/${chainId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('restore', () => {
    it('[3.6b-UNIT-004d] [P1] Given chain ID, when restore is called, then PATCH request is sent to restore endpoint', () => {
      // Given
      const chainId = 'chain-id-123';

      // When
      service.restore(chainId).subscribe((result) => {
        // Then
        expect(result).toEqual(mockChainResponse);
      });

      const req = httpMock.expectOne(`${baseUrl}/${chainId}/restore`);
      expect(req.request.method).toBe('PATCH');
      req.flush(mockChainResponse);
    });
  });
});
