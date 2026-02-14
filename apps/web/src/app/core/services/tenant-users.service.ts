import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { UserResponseDto } from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class TenantUsersService {
  private readonly http = inject(HttpClient);

  getAll(tenantId: string): Observable<UserResponseDto[]> {
    return this.http.get<UserResponseDto[]>(
      `/api/admin/tenants/${tenantId}/users`,
    );
  }
}
