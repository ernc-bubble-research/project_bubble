import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tenant, CreateTenantPayload } from '@project-bubble/shared';

export type { Tenant, CreateTenantPayload } from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/tenants';

  getAll(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(this.baseUrl);
  }

  getOne(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.baseUrl}/${id}`);
  }

  create(payload: CreateTenantPayload): Observable<Tenant> {
    return this.http.post<Tenant>(this.baseUrl, payload);
  }
}
