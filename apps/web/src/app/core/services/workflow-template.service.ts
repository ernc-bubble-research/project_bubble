import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  WorkflowTemplateResponseDto,
  CreateWorkflowTemplateDto,
  CreateWorkflowVersionBodyDto,
  WorkflowVersionResponseDto,
  ListWorkflowTemplatesQueryDto,
} from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class WorkflowTemplateService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/workflow-templates';

  create(dto: CreateWorkflowTemplateDto): Observable<WorkflowTemplateResponseDto> {
    return this.http.post<WorkflowTemplateResponseDto>(this.baseUrl, dto);
  }

  getById(id: string): Observable<WorkflowTemplateResponseDto> {
    return this.http.get<WorkflowTemplateResponseDto>(`${this.baseUrl}/${id}`);
  }

  getAll(params?: ListWorkflowTemplatesQueryDto): Observable<WorkflowTemplateResponseDto[]> {
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
    }
    return this.http.get<WorkflowTemplateResponseDto[]>(this.baseUrl, { params: httpParams });
  }

  // L4: Properly typed return as WorkflowVersionResponseDto
  createVersion(templateId: string, dto: CreateWorkflowVersionBodyDto): Observable<WorkflowVersionResponseDto> {
    return this.http.post<WorkflowVersionResponseDto>(`${this.baseUrl}/${templateId}/versions`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
