import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  WorkflowTemplateResponseDto,
  CreateWorkflowTemplateDto,
  CreateWorkflowVersionBodyDto,
  WorkflowVersionResponseDto,
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

  // L4: Properly typed return as WorkflowVersionResponseDto
  createVersion(templateId: string, dto: CreateWorkflowVersionBodyDto): Observable<WorkflowVersionResponseDto> {
    return this.http.post<WorkflowVersionResponseDto>(`${this.baseUrl}/${templateId}/versions`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
