import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  LlmProviderConfigResponseDto,
  CreateLlmProviderConfigDto,
  UpdateLlmProviderConfigDto,
  AffectedWorkflowDto,
  DeactivateModelResponseDto,
} from '@project-bubble/shared';

export type LlmProviderConfig = LlmProviderConfigResponseDto;

@Injectable({ providedIn: 'root' })
export class LlmProviderService {
  private readonly http = inject(HttpClient);

  /** Get all provider configs (admin only) */
  getAllConfigs(): Observable<LlmProviderConfig[]> {
    return this.http.get<LlmProviderConfig[]>(
      '/api/admin/settings/llm-providers',
    );
  }

  /** Create a new provider config (admin only) */
  createConfig(
    dto: CreateLlmProviderConfigDto,
  ): Observable<LlmProviderConfig> {
    return this.http.post<LlmProviderConfig>(
      '/api/admin/settings/llm-providers',
      dto,
    );
  }

  /** Update an existing provider config (admin only) */
  updateConfig(
    id: string,
    dto: UpdateLlmProviderConfigDto,
  ): Observable<LlmProviderConfig> {
    return this.http.patch<LlmProviderConfig>(
      `/api/admin/settings/llm-providers/${id}`,
      dto,
    );
  }

  /** Get workflow versions affected by deactivating a provider (admin only) */
  getAffectedWorkflows(providerId: string): Observable<AffectedWorkflowDto[]> {
    return this.http.get<AffectedWorkflowDto[]>(
      `/api/admin/settings/llm-providers/${providerId}/affected-workflows`,
    );
  }

  /** Deactivate a provider with mandatory reassignment (admin only) */
  deactivateProvider(providerId: string, replacementModelId: string): Observable<DeactivateModelResponseDto[]> {
    return this.http.post<DeactivateModelResponseDto[]>(
      `/api/admin/settings/llm-providers/${providerId}/deactivate`,
      { replacementModelId },
    );
  }
}
