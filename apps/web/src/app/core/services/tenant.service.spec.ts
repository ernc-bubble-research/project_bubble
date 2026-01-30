import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TenantService, Tenant } from './tenant.service';

describe('TenantService', () => {
  let service: TenantService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TenantService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should GET all tenants', () => {
    const mockTenants: Tenant[] = [
      {
        id: '1',
        name: 'Acme',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];

    service.getAll().subscribe((tenants) => {
      expect(tenants).toEqual(mockTenants);
    });

    const req = httpTesting.expectOne('/api/admin/tenants');
    expect(req.request.method).toBe('GET');
    req.flush(mockTenants);
  });

  it('should GET one tenant by id', () => {
    const mockTenant: Tenant = {
      id: 'abc-123',
      name: 'Acme',
      status: 'active',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };

    service.getOne('abc-123').subscribe((tenant) => {
      expect(tenant).toEqual(mockTenant);
    });

    const req = httpTesting.expectOne('/api/admin/tenants/abc-123');
    expect(req.request.method).toBe('GET');
    req.flush(mockTenant);
  });

  it('should POST to create a tenant', () => {
    const payload = { name: 'New Corp' };
    const mockResponse: Tenant = {
      id: 'new-id',
      name: 'New Corp',
      status: 'active',
      createdAt: '2026-01-30',
      updatedAt: '2026-01-30',
    };

    service.create(payload).subscribe((tenant) => {
      expect(tenant).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne('/api/admin/tenants');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });
});
