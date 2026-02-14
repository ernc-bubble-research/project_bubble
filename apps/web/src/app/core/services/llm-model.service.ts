import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  LlmModelResponseDto,
  CreateLlmModelDto,
  UpdateLlmModelDto,
  BulkUpdateModelStatusDto,
} from '@project-bubble/shared';

// H5: Re-export as LlmModel alias for backward compatibility within the app
export type LlmModel = LlmModelResponseDto;

@Injectable({ providedIn: 'root' })
export class LlmModelService {
  private readonly http = inject(HttpClient);

  /** Get active models only (for app usage, all roles) */
  getActiveModels(): Observable<LlmModel[]> {
    return this.http.get<LlmModel[]>('/api/app/llm-models');
  }

  /** Get all models including inactive (admin only) */
  getAllModels(): Observable<LlmModel[]> {
    return this.http.get<LlmModel[]>('/api/admin/llm-models');
  }

  /** Create a new LLM model (admin only) */
  createModel(dto: CreateLlmModelDto): Observable<LlmModel> {
    return this.http.post<LlmModel>('/api/admin/llm-models', dto);
  }

  /** Update an existing LLM model (admin only) */
  updateModel(id: string, dto: UpdateLlmModelDto): Observable<LlmModel> {
    return this.http.patch<LlmModel>(`/api/admin/llm-models/${id}`, dto);
  }

  /** Bulk update active status for all models of a provider (admin only) */
  bulkUpdateStatus(dto: BulkUpdateModelStatusDto): Observable<{ affected: number }> {
    return this.http.patch<{ affected: number }>('/api/admin/llm-models/bulk-status', dto);
  }
}
