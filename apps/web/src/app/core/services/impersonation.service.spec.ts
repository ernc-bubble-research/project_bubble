import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { ImpersonationService } from './impersonation.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('ImpersonationService', () => {
  let service: ImpersonationService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/dashboard', component: DummyComponent },
          { path: '**', component: DummyComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ImpersonationService,
      ],
    });

    service = TestBed.inject(ImpersonationService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    service.stopInactivityTimer();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call POST /api/admin/tenants/:id/impersonate', () => {
    service.impersonate('tenant-123').subscribe((res) => {
      expect(res.token).toBe('jwt-token');
      expect(res.tenant.name).toBe('Acme Corp');
    });

    const req = httpMock.expectOne('/api/admin/tenants/tenant-123/impersonate');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt-token', tenant: { id: 'tenant-123', name: 'Acme Corp' } });
  });

  it('should store impersonation data in localStorage', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' });

    expect(localStorage.getItem('impersonation_token')).toBe('jwt-token');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(JSON.parse(localStorage.getItem('impersonation_tenant')!)).toEqual({
      id: 'tenant-123',
      name: 'Acme Corp',
    });
    expect(service.isImpersonating()).toBe(true);
    expect(service.impersonatedTenant()).toEqual({ id: 'tenant-123', name: 'Acme Corp' });
  });

  it('should clear impersonation on exitImpersonation', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' });
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    service.exitImpersonation();

    expect(localStorage.getItem('impersonation_token')).toBeNull();
    expect(localStorage.getItem('impersonation_tenant')).toBeNull();
    expect(service.isImpersonating()).toBe(false);
    expect(service.impersonatedTenant()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should show and auto-dismiss toast', () => {
    service.showToast('Test message');
    expect(service.toastMessage()).toBe('Test message');

    service.dismissToast();
    expect(service.toastMessage()).toBeNull();
  });
});
