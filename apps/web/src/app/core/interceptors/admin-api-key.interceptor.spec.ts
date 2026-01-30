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
import { adminApiKeyInterceptor } from './admin-api-key.interceptor';

describe('adminApiKeyInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([adminApiKeyInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should add x-admin-api-key header to admin requests', () => {
    http.get('/api/admin/tenants').subscribe();

    const req = httpTesting.expectOne('/api/admin/tenants');
    expect(req.request.headers.has('x-admin-api-key')).toBe(true);
    req.flush([]);
  });

  it('should NOT add header to non-admin requests', () => {
    http.get('/api/workflows').subscribe();

    const req = httpTesting.expectOne('/api/workflows');
    expect(req.request.headers.has('x-admin-api-key')).toBe(false);
    req.flush([]);
  });
});
