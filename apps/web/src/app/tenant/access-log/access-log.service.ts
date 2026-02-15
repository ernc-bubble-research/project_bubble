import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AccessLogEntryDto } from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class AccessLogService {
  private readonly http = inject(HttpClient);

  getAccessLog(): Observable<AccessLogEntryDto[]> {
    return this.http.get<AccessLogEntryDto[]>('/api/app/access-log');
  }
}
