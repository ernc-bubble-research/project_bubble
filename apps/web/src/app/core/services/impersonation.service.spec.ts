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

describe('ImpersonationService [P1]', () => {
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
    jest.useRealTimers();
  });

  it('[1H.1-UNIT-001] should be created', () => {
    expect(service).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should call POST /api/admin/tenants/:id/impersonate', () => {
    service.impersonate('tenant-123').subscribe((res) => {
      expect(res.token).toBe('jwt-token');
      expect(res.tenant.name).toBe('Acme Corp');
    });

    const req = httpMock.expectOne('/api/admin/tenants/tenant-123/impersonate');
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'jwt-token', tenant: { id: 'tenant-123', name: 'Acme Corp' }, sessionId: 'session-1' });
  });

  it('[1H.1-UNIT-003] should store impersonation data and sessionId in localStorage', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');

    expect(localStorage.getItem('impersonation_token')).toBe('jwt-token');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(JSON.parse(localStorage.getItem('impersonation_tenant')!)).toEqual({
      id: 'tenant-123',
      name: 'Acme Corp',
    });
    expect(localStorage.getItem('impersonation_session_id')).toBe('session-abc');
    expect(service.isImpersonating()).toBe(true);
    expect(service.impersonatedTenant()).toEqual({ id: 'tenant-123', name: 'Acme Corp' });
  });

  it('[1H.1-UNIT-004] should clear impersonation and call session-end API on exit', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    service.exitImpersonation();

    // Impersonation token should be cleared
    expect(localStorage.getItem('impersonation_token')).toBeNull();
    expect(localStorage.getItem('impersonation_tenant')).toBeNull();
    expect(localStorage.getItem('impersonation_session_id')).toBeNull();
    expect(service.isImpersonating()).toBe(false);
    expect(service.impersonatedTenant()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/dashboard']);

    // Verify session-end API call (fire-and-forget)
    const req = httpMock.expectOne('/api/admin/tenants/impersonation/end');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ sessionId: 'session-abc' });
    req.flush({ ok: true });
  });

  it('[4-SA-UNIT-002] should not call session-end API if no sessionId stored', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
    // Manually remove session ID to simulate missing state
    localStorage.removeItem('impersonation_session_id');
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    service.exitImpersonation();

    httpMock.expectNone('/api/admin/tenants/impersonation/end');
  });

  it('[4-SA-UNIT-003] should not block exit if session-end API fails', () => {
    service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    service.exitImpersonation();

    // Verify state is cleared even though API hasn't responded
    expect(service.isImpersonating()).toBe(false);

    // Simulate API failure — should not throw
    const req = httpMock.expectOne('/api/admin/tenants/impersonation/end');
    req.error(new ProgressEvent('error'));
  });

  it('[1H.1-UNIT-005] should show and auto-dismiss toast', () => {
    service.showToast('Test message');
    expect(service.toastMessage()).toBe('Test message');

    service.dismissToast();
    expect(service.toastMessage()).toBeNull();
  });

  describe('duplicate exit guard', () => {
    it('[4-SAB-UNIT-020] should ignore second exitImpersonation call (duplicate guard)', () => {
      service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      // First call
      service.exitImpersonation();
      // Second call — should be no-op
      service.exitImpersonation();

      expect(navigateSpy).toHaveBeenCalledTimes(1);

      // Only one session-end POST
      const reqs = httpMock.match('/api/admin/tenants/impersonation/end');
      expect(reqs).toHaveLength(1);
      reqs[0].flush({ ok: true });
    });

    it('[4-SAB-UNIT-021] should expose isExiting flag', () => {
      expect(service.isExiting).toBe(false);

      service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
      jest.spyOn(router, 'navigate').mockResolvedValue(true);

      service.exitImpersonation();
      // isExiting should be true until navigation resolves
      expect(service.isExiting).toBe(true);

      const req = httpMock.expectOne('/api/admin/tenants/impersonation/end');
      req.flush({ ok: true });
    });

    it('[4-SAB-UNIT-022] should reset _exiting flag after storeImpersonation', () => {
      service.storeImpersonation('jwt-token', { id: 'tenant-123', name: 'Acme Corp' }, 'session-abc');
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      service.exitImpersonation();

      expect(service.isExiting).toBe(true);

      // New impersonation should reset the flag
      service.storeImpersonation('jwt-token-2', { id: 'tenant-456', name: 'Beta Corp' }, 'session-def');
      expect(service.isExiting).toBe(false);

      const req = httpMock.expectOne('/api/admin/tenants/impersonation/end');
      req.flush({ ok: true });
    });
  });

  describe('inactivity pre-warning toast', () => {
    it('[4-SAB-UNIT-023] should show warning toast at T-60s (29 min)', () => {
      jest.useFakeTimers();

      service.storeImpersonation('jwt-token', { id: 't1', name: 'Test' }, 'session-1');
      service.startInactivityTimer();

      const toastSpy = jest.spyOn(service, 'showToast');

      // Advance to 29 minutes (just past warning threshold)
      jest.advanceTimersByTime(29 * 60 * 1000 + 10);

      expect(toastSpy).toHaveBeenCalledWith('Session will expire in 1 minute due to inactivity.');

      service.stopInactivityTimer();
    });

    it('[4-SAB-UNIT-024] should NOT show warning before 29 minutes', () => {
      jest.useFakeTimers();

      service.storeImpersonation('jwt-token', { id: 't1', name: 'Test' }, 'session-1');
      service.startInactivityTimer();

      const toastSpy = jest.spyOn(service, 'showToast');

      // Advance to 28 minutes — not enough
      jest.advanceTimersByTime(28 * 60 * 1000);

      expect(toastSpy).not.toHaveBeenCalled();

      service.stopInactivityTimer();
    });

    it('[4-SAB-UNIT-025] should reset warning timer on user activity', () => {
      jest.useFakeTimers();

      service.storeImpersonation('jwt-token', { id: 't1', name: 'Test' }, 'session-1');
      service.startInactivityTimer();

      const toastSpy = jest.spyOn(service, 'showToast');

      // Advance 20 minutes
      jest.advanceTimersByTime(20 * 60 * 1000);

      // Simulate activity (resets timer)
      document.dispatchEvent(new Event('mousemove'));

      // Advance another 20 minutes from reset (total 40 from start, 20 from activity)
      jest.advanceTimersByTime(20 * 60 * 1000);

      // Should NOT have shown warning yet (only 20 min since activity, need 29)
      expect(toastSpy).not.toHaveBeenCalled();

      service.stopInactivityTimer();
    });
  });
});
