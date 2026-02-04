import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  WorkflowChainResponseDto,
  CreateWorkflowChainDto,
  UpdateWorkflowChainDto,
  ListWorkflowChainsQueryDto,
} from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class WorkflowChainService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/workflow-chains';

  create(dto: CreateWorkflowChainDto): Observable<WorkflowChainResponseDto> {
    return this.http.post<WorkflowChainResponseDto>(this.baseUrl, dto);
  }

  getAll(params?: ListWorkflowChainsQueryDto): Observable<WorkflowChainResponseDto[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.limit !== undefined) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.offset !== undefined) {
        httpParams = httpParams.set('offset', params.offset.toString());
      }
      if (params.status) {
        httpParams = httpParams.set('status', params.status);
      }
      if (params.visibility) {
        httpParams = httpParams.set('visibility', params.visibility);
      }
    }
    return this.http.get<WorkflowChainResponseDto[]>(this.baseUrl, { params: httpParams });
  }

  getById(id: string): Observable<WorkflowChainResponseDto> {
    return this.http.get<WorkflowChainResponseDto>(`${this.baseUrl}/${id}`);
  }

  update(id: string, dto: UpdateWorkflowChainDto): Observable<WorkflowChainResponseDto> {
    return this.http.put<WorkflowChainResponseDto>(`${this.baseUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  publish(id: string): Observable<WorkflowChainResponseDto> {
    return this.http.patch<WorkflowChainResponseDto>(`${this.baseUrl}/${id}/publish`, {});
  }

  restore(id: string): Observable<WorkflowChainResponseDto> {
    return this.http.patch<WorkflowChainResponseDto>(`${this.baseUrl}/${id}/restore`, {});
  }
}
