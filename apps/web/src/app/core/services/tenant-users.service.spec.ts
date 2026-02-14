import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TenantUsersService } from './tenant-users.service';
import type { UserResponseDto } from '@project-bubble/shared';

const tenantId = '123e4567-e89b-12d3-a456-426614174000';

const mockUsers: UserResponseDto[] = [
  {
    id: 'user-001',
    email: 'alice@acme.com',
    role: 'customer_admin',
    name: 'Alice',
    tenantId,
    status: 'active',
    createdAt: new Date('2026-01-20T00:00:00Z'),
  },
  {
    id: 'user-002',
    email: 'bob@acme.com',
    role: 'creator',
    tenantId,
    status: 'active',
    createdAt: new Date('2026-01-22T00:00:00Z'),
  },
];

describe('TenantUsersService [P2]', () => {
  let service: TenantUsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TenantUsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('[4-FIX-B-UNIT-H4-005] should GET /api/admin/tenants/:tenantId/users', () => {
      service.getAll(tenantId).subscribe((result) => {
        expect(result).toEqual(mockUsers);
        expect(result).toHaveLength(2);
      });

      const req = httpMock.expectOne(`/api/admin/tenants/${tenantId}/users`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('[4-FIX-B-UNIT-H4-006] should return empty array when tenant has no users', () => {
      service.getAll(tenantId).subscribe((result) => {
        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      const req = httpMock.expectOne(`/api/admin/tenants/${tenantId}/users`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
