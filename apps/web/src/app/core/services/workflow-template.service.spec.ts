import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { WorkflowTemplateService } from './workflow-template.service';

/**
 * [P0] WorkflowTemplateService — HTTP client tests
 */
describe('[P0] WorkflowTemplateService', () => {
  let service: WorkflowTemplateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        WorkflowTemplateService,
      ],
    });

    service = TestBed.inject(WorkflowTemplateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('[3.2-UNIT-033] should create a workflow template via POST', () => {
    // Given a create template request
    const dto = { name: 'Test Workflow', description: 'A test', visibility: 'public' as const };
    const mockResponse = { id: '123', name: 'Test Workflow', tenantId: 't1' };

    // When calling create
    service.create(dto).subscribe((res) => {
      // Then the response should have an id
      expect(res.id).toBe('123');
    });

    // Then a POST request should be made
    const req = httpMock.expectOne('/api/admin/workflow-templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(mockResponse);
  });

  it('[3.2-UNIT-034] should create a version via POST', () => {
    // Given a version creation request
    const templateId = '123';
    const dto = { definition: { metadata: { name: 'test' } } };

    // When calling createVersion
    service.createVersion(templateId, dto).subscribe();

    // Then a POST request should be made
    const req = httpMock.expectOne(`/api/admin/workflow-templates/${templateId}/versions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('[3.2-UNIT-035] should get template by id via GET', () => {
    // Given a template id
    const id = '456';
    const mockResponse = { id: '456', name: 'Test', currentVersion: null };

    // When calling getById
    service.getById(id).subscribe((res) => {
      expect(res.id).toBe('456');
    });

    // Then a GET request should be made
    const req = httpMock.expectOne(`/api/admin/workflow-templates/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('[3.2-UNIT-036] should delete template (orphan cleanup) via DELETE', () => {
    // Given an orphaned template id
    const id = '789';

    // When calling delete
    service.delete(id).subscribe();

    // Then a DELETE request should be made
    const req = httpMock.expectOne(`/api/admin/workflow-templates/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
