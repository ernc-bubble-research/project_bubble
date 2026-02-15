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
import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor [P0]', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
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
});
