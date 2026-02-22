import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { WorkflowRunResponseDto } from '@project-bubble/shared';

export interface WorkflowRunListResponse {
  data: WorkflowRunResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export interface WorkflowRunListParams {
  page?: number;
  limit?: number;
  status?: string;
  excludeTestRuns?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkflowRunService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/app/workflow-runs';

  listRuns(params: WorkflowRunListParams = {}): Observable<WorkflowRunListResponse> {
    let httpParams = new HttpParams();
    if (params.page != null) httpParams = httpParams.set('page', params.page);
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit);
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.excludeTestRuns) httpParams = httpParams.set('excludeTestRuns', 'true');

    return this.http.get<WorkflowRunListResponse>(this.baseUrl, { params: httpParams });
  }

  getRun(id: string): Observable<WorkflowRunResponseDto> {
    return this.http.get<WorkflowRunResponseDto>(`${this.baseUrl}/${id}`);
  }

  retryFailed(id: string): Observable<WorkflowRunResponseDto> {
    return this.http.post<WorkflowRunResponseDto>(`${this.baseUrl}/${id}/retry-failed`, {});
  }

  downloadOutput(id: string, fileIndex: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/outputs/${fileIndex}`, {
      responseType: 'blob',
    });
  }
}
