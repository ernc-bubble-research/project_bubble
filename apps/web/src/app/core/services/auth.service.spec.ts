import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService [P0]', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  // A valid JWT that decodes to { sub: '123', tenant_id: 'tid', role: 'bubble_admin', exp: <future> }
  const futureExp = Math.floor(Date.now() / 1000) + 86400;
  const payload = btoa(
    JSON.stringify({
      sub: '123',
      tenant_id: 'tid',
      role: 'bubble_admin',
      exp: futureExp,
    }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const mockToken = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;

  const expiredPayload = btoa(
    JSON.stringify({
      sub: '123',
      tenant_id: 'tid',
      role: 'bubble_admin',
      exp: 1000000000,
    }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const expiredToken = `eyJhbGciOiJIUzI1NiJ9.${expiredPayload}.signature`;

  const mockProfile = {
    id: '123',
    email: 'admin@bubble.io',
    role: 'bubble_admin' as const,
    name: 'Admin User',
    tenantId: 'tid',
    status: 'active',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  describe('login', () => {
    it('[1H.1-UNIT-001] should store token on successful login', () => {
      service.login('admin@bubble.io', 'Admin123!').subscribe((res) => {
        expect(res.accessToken).toBe('jwt-token');
        expect(localStorage.getItem('bubble_access_token')).toBe('jwt-token');
      });

      const req = httpTesting.expectOne('/api/auth/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        email: 'admin@bubble.io',
        password: 'Admin123!',
      });
      req.flush({
        accessToken: 'jwt-token',
        user: {
          id: '123',
          email: 'admin@bubble.io',
          role: 'bubble_admin',
          tenantId: 'tid',
        },
      });

      // Login triggers loadProfile() which fetches /api/auth/me
      const profileReq = httpTesting.expectOne('/api/auth/me');
      expect(profileReq.request.method).toBe('GET');
      profileReq.flush(mockProfile);
    });
  });

  describe('logout', () => {
    it('[1H.1-UNIT-002] should clear stored token', () => {
      localStorage.setItem('bubble_access_token', 'some-token');

      service.logout();

      expect(localStorage.getItem('bubble_access_token')).toBeNull();
    });
  });

  describe('getToken', () => {
    it('[1H.1-UNIT-003] should return stored token', () => {
      localStorage.setItem('bubble_access_token', 'test-token');

      expect(service.getToken()).toBe('test-token');
    });

    it('[1H.1-UNIT-004] should return null when no token stored', () => {
      expect(service.getToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('[1H.1-UNIT-005] should return true when token is valid and not expired', () => {
      localStorage.setItem('bubble_access_token', mockToken);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('[1H.1-UNIT-006] should return false when token is expired', () => {
      localStorage.setItem('bubble_access_token', expiredToken);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('[1H.1-UNIT-007] should return false when no token exists', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('[1H.1-UNIT-008] should return false for malformed token', () => {
      localStorage.setItem('bubble_access_token', 'not-a-jwt');

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('[1H.1-UNIT-009] should decode user from valid token', () => {
      localStorage.setItem('bubble_access_token', mockToken);

      const user = service.getCurrentUser();

      expect(user).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const u = user!;
      expect(u.id).toBe('123');
      expect(u.role).toBe('bubble_admin');
      expect(u.tenantId).toBe('tid');
    });

    it('[1H.1-UNIT-010] should return null when no token', () => {
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  describe('loadProfile', () => {
    it('[3.1-2-UNIT-005] should populate user signal when profile fetch succeeds', () => {
      // Given — a token exists in localStorage
      localStorage.setItem('bubble_access_token', mockToken);

      // When
      service.loadProfile();
      const req = httpTesting.expectOne('/api/auth/me');
      req.flush(mockProfile);

      // Then
      expect(service.user()).toEqual(mockProfile);
    });

    it('[3.1-2-UNIT-006] should not make request when no token exists', () => {
      // Given — no token in localStorage (already cleared in beforeEach)

      // When
      service.loadProfile();

      // Then — no HTTP request made
      httpTesting.expectNone('/api/auth/me');
      expect(service.user()).toBeNull();
    });

    it('[3.1-2-UNIT-007] should keep user signal null when profile fetch fails', () => {
      // Given — a token exists but the request will fail
      localStorage.setItem('bubble_access_token', mockToken);

      // When
      service.loadProfile();
      const req = httpTesting.expectOne('/api/auth/me');
      req.flush(null, { status: 401, statusText: 'Unauthorized' });

      // Then
      expect(service.user()).toBeNull();
    });

    it('[3.1-2-UNIT-008] should be triggered after login', () => {
      // Given — a successful login response
      service.login('admin@bubble.io', 'Admin123!').subscribe();
      const loginReq = httpTesting.expectOne('/api/auth/login');
      loginReq.flush({
        accessToken: mockToken,
        user: { id: '123', email: 'admin@bubble.io', role: 'bubble_admin', tenantId: 'tid' },
      });

      // When — login tap stores token and calls loadProfile
      const profileReq = httpTesting.expectOne('/api/auth/me');
      profileReq.flush(mockProfile);

      // Then
      expect(service.user()).toEqual(mockProfile);
    });

    it('[3.1-2-UNIT-009] should clear user signal on logout', () => {
      // Given — user signal is populated
      service.user.set(mockProfile);

      // When
      service.logout();

      // Then
      expect(service.user()).toBeNull();
      expect(localStorage.getItem('bubble_access_token')).toBeNull();
    });
  });
});
