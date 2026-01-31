import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
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
    it('should store token on successful login', () => {
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
    });
  });

  describe('logout', () => {
    it('should clear stored token', () => {
      localStorage.setItem('bubble_access_token', 'some-token');

      service.logout();

      expect(localStorage.getItem('bubble_access_token')).toBeNull();
    });
  });

  describe('getToken', () => {
    it('should return stored token', () => {
      localStorage.setItem('bubble_access_token', 'test-token');

      expect(service.getToken()).toBe('test-token');
    });

    it('should return null when no token stored', () => {
      expect(service.getToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token is valid and not expired', () => {
      localStorage.setItem('bubble_access_token', mockToken);

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when token is expired', () => {
      localStorage.setItem('bubble_access_token', expiredToken);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false when no token exists', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false for malformed token', () => {
      localStorage.setItem('bubble_access_token', 'not-a-jwt');

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should decode user from valid token', () => {
      localStorage.setItem('bubble_access_token', mockToken);

      const user = service.getCurrentUser();

      expect(user).not.toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const u = user!;
      expect(u.id).toBe('123');
      expect(u.role).toBe('bubble_admin');
      expect(u.tenantId).toBe('tid');
    });

    it('should return null when no token', () => {
      expect(service.getCurrentUser()).toBeNull();
    });
  });
});
