import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  WorkflowTemplateResponseDto,
  InitiateWorkflowRunDto,
  WorkflowRunResponseDto,
} from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class WorkflowCatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/app/workflow-templates';
  private readonly runsUrl = '/api/app/workflow-runs';

  listPublished(): Observable<WorkflowTemplateResponseDto[]> {
    return this.http.get<WorkflowTemplateResponseDto[]>(this.baseUrl);
  }

  getById(id: string): Observable<WorkflowTemplateResponseDto> {
    return this.http.get<WorkflowTemplateResponseDto>(`${this.baseUrl}/${id}`);
  }

  submitRun(dto: InitiateWorkflowRunDto): Observable<WorkflowRunResponseDto> {
    return this.http.post<WorkflowRunResponseDto>(this.runsUrl, dto);
  }
}
