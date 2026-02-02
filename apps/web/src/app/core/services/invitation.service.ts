import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { InvitationResponseDto, InviteUserDto } from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly http = inject(HttpClient);

  create(
    tenantId: string,
    dto: InviteUserDto,
  ): Observable<InvitationResponseDto> {
    return this.http.post<InvitationResponseDto>(
      `/api/admin/tenants/${tenantId}/invitations`,
      dto,
    );
  }

  getAll(tenantId: string): Observable<InvitationResponseDto[]> {
    return this.http.get<InvitationResponseDto[]>(
      `/api/admin/tenants/${tenantId}/invitations`,
    );
  }

  resend(tenantId: string, id: string): Observable<void> {
    return this.http.post<void>(
      `/api/admin/tenants/${tenantId}/invitations/${id}/resend`,
      {},
    );
  }

  revoke(tenantId: string, id: string): Observable<void> {
    return this.http.delete<void>(
      `/api/admin/tenants/${tenantId}/invitations/${id}`,
    );
  }
}
