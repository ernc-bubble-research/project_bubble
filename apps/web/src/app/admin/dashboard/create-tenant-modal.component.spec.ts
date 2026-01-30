import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { CreateTenantModalComponent } from './create-tenant-modal.component';

describe('CreateTenantModalComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateTenantModalComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(CreateTenantModalComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show error for empty name', () => {
    const fixture = TestBed.createComponent(CreateTenantModalComponent);
    const component = fixture.componentInstance;

    component.tenantName = '   ';
    component.submit();

    expect(component.errorMessage()).toBe('Tenant name is required.');
  });

  it('should submit valid name and emit created', () => {
    const fixture = TestBed.createComponent(CreateTenantModalComponent);
    const component = fixture.componentInstance;
    const createdSpy = jest.spyOn(component.created, 'emit');

    component.tenantName = 'Acme Corp';
    component.submit();

    const req = httpTesting.expectOne('/api/admin/tenants');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Acme Corp' });

    req.flush({
      id: '1',
      name: 'Acme Corp',
      status: 'active',
      createdAt: '2026-01-30',
      updatedAt: '2026-01-30',
    });

    expect(createdSpy).toHaveBeenCalled();
    expect(component.submitting()).toBe(false);
  });

  it('should show error on 409 conflict', () => {
    const fixture = TestBed.createComponent(CreateTenantModalComponent);
    const component = fixture.componentInstance;

    component.tenantName = 'Acme Corp';
    component.submit();

    const req = httpTesting.expectOne('/api/admin/tenants');
    req.flush(
      { message: 'Conflict' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(component.errorMessage()).toContain('already exists');
    expect(component.submitting()).toBe(false);
  });

  it('should emit closed when close is called', () => {
    const fixture = TestBed.createComponent(CreateTenantModalComponent);
    const closedSpy = jest.spyOn(fixture.componentInstance.closed, 'emit');

    fixture.componentInstance.close();
    expect(closedSpy).toHaveBeenCalled();
  });
});
