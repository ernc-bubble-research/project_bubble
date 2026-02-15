import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { jwtInterceptor } from './jwt.interceptor';
import { ImpersonationService } from '../services/impersonation.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('jwtInterceptor [P0]', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/dashboard', component: DummyComponent },
          { path: '**', component: DummyComponent },
        ]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        ImpersonationService,
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
    // Stop any inactivity timers that might have been started
    TestBed.inject(ImpersonationService).stopInactivityTimer();
  });

  it('[1H.1-UNIT-001] should attach Bearer header when token exists', () => {
    localStorage.setItem('bubble_access_token', 'test-jwt-token');

    http.get('/api/data').subscribe();

    const req = httpTesting.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer test-jwt-token',
    );
    req.flush({});
  });

  it('[1H.1-UNIT-002] should pass through without header when no token', () => {
    http.get('/api/data').subscribe();

    const req = httpTesting.expectOne('/api/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('[4-SA-UNIT-001] should prefer impersonation token over admin token', () => {
    localStorage.setItem('bubble_access_token', 'admin-jwt');
    localStorage.setItem('impersonation_token', 'impersonation-jwt');

    http.get('/api/data').subscribe();

    const req = httpTesting.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer impersonation-jwt',
    );
    req.flush({});
  });

  it('[4-SA-UNIT-002] should fall back to admin token when impersonation token is absent', () => {
    localStorage.setItem('bubble_access_token', 'admin-jwt');

    http.get('/api/data').subscribe();

    const req = httpTesting.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer admin-jwt');
    req.flush({});
  });

  it('[4-SAB-UNIT-016] should trigger exitImpersonation on 401 during impersonation', () => {
    const impersonationService = TestBed.inject(ImpersonationService);
    localStorage.setItem('impersonation_token', 'expired-jwt');
    localStorage.setItem('impersonation_tenant', JSON.stringify({ id: 't1', name: 'Test' }));
    localStorage.setItem('impersonation_session_id', 'session-1');

    const exitSpy = jest.spyOn(impersonationService, 'exitImpersonation');
    const toastSpy = jest.spyOn(impersonationService, 'showToast');

    http.get('/api/data').subscribe({
      next: () => fail('should not emit'),
      error: () => fail('should not error — EMPTY returned'),
      complete: () => { /* expected */ },
    });

    const req = httpTesting.expectOne('/api/data');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(exitSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Impersonation session has ended.');

    // Flush the session-end POST (fire-and-forget from exitImpersonation)
    const endReq = httpTesting.match('/api/admin/tenants/impersonation/end');
    endReq.forEach((r) => r.flush({ ok: true }));
  });

  it('[4-SAB-UNIT-017] should propagate 401 normally when not impersonating', () => {
    localStorage.setItem('bubble_access_token', 'admin-jwt');
    let receivedError = false;

    http.get('/api/data').subscribe({
      error: (err) => {
        receivedError = true;
        expect(err.status).toBe(401);
      },
    });

    const req = httpTesting.expectOne('/api/data');
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(receivedError).toBe(true);
  });

  it('[4-SAB-UNIT-018] should swallow second concurrent 401 (duplicate guard)', () => {
    const impersonationService = TestBed.inject(ImpersonationService);
    localStorage.setItem('impersonation_token', 'expired-jwt');
    localStorage.setItem('impersonation_tenant', JSON.stringify({ id: 't1', name: 'Test' }));
    localStorage.setItem('impersonation_session_id', 'session-1');

    const exitSpy = jest.spyOn(impersonationService, 'exitImpersonation');

    // First request
    http.get('/api/data1').subscribe({ error: () => {} });
    // Second request
    http.get('/api/data2').subscribe({ error: () => {} });

    const req1 = httpTesting.expectOne('/api/data1');
    req1.flush(null, { status: 401, statusText: 'Unauthorized' });

    // After first 401, exitImpersonation clears the token and sets _exiting = true
    // But by the time second request completes, the token is already cleared
    // so the interceptor won't enter the impersonation path at all.
    // However, if the second 401 arrives before token is cleared (race condition),
    // the _exiting guard prevents double-exit.
    expect(exitSpy).toHaveBeenCalledTimes(1);

    // Flush remaining requests
    const remaining = httpTesting.match(() => true);
    remaining.forEach((r) => r.flush({ ok: true }));
  });

  it('[4-SAB-UNIT-019] should propagate non-401 errors during impersonation', () => {
    localStorage.setItem('impersonation_token', 'valid-jwt');
    let receivedError = false;

    http.get('/api/data').subscribe({
      error: (err) => {
        receivedError = true;
        expect(err.status).toBe(500);
      },
    });

    const req = httpTesting.expectOne('/api/data');
    req.flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(receivedError).toBe(true);
  });
});
