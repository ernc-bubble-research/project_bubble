import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard, adminGuard } from './auth.guard';
import { noAuthGuard } from './no-auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authServiceMock: Record<string, jest.Mock>;
  let router: Router;

  beforeEach(() => {
    authServiceMock = {
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow navigation when authenticated', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/admin/dashboard' } as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
  });

  it('should redirect to /auth/login with returnUrl when not authenticated', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(false);
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');

    TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/admin/dashboard' } as RouterStateSnapshot
      )
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/admin/dashboard' },
    });
  });
});

describe('adminGuard', () => {
  let authServiceMock: Record<string, jest.Mock>;
  let router: Router;

  beforeEach(() => {
    authServiceMock = {
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow navigation for bubble_admin', () => {
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '1',
      email: 'admin@test.com',
      role: 'bubble_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });

    const result = TestBed.runInInjectionContext(() =>
      adminGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
  });

  it('should redirect non-admin users to /app/workflows', () => {
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '2',
      email: 'creator@test.com',
      role: 'creator',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');

    TestBed.runInInjectionContext(() =>
      adminGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/app/workflows']);
  });
});

describe('noAuthGuard', () => {
  let authServiceMock: Record<string, jest.Mock>;
  let router: Router;

  beforeEach(() => {
    authServiceMock = {
      isAuthenticated: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('should allow navigation when not authenticated', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      noAuthGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(result).toBe(true);
  });

  it('should redirect bubble_admin to /admin/dashboard', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(true);
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '1',
      email: 'admin@test.com',
      role: 'bubble_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');

    TestBed.runInInjectionContext(() =>
      noAuthGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should redirect non-admin users to /app/workflows', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(true);
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '2',
      email: 'creator@test.com',
      role: 'creator',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');

    TestBed.runInInjectionContext(() =>
      noAuthGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/app/workflows']);
  });

  it('should redirect customer_admin to /app/workflows', () => {
    authServiceMock['isAuthenticated'].mockReturnValue(true);
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '3',
      email: 'ca@test.com',
      role: 'customer_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const createUrlTreeSpy = jest.spyOn(router, 'createUrlTree');

    TestBed.runInInjectionContext(() =>
      noAuthGuard(
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot
      )
    );

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/app/workflows']);
  });
});
