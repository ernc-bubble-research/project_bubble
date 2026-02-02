import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { LlmModelResponseDto } from '@project-bubble/shared';

// H5: Re-export as LlmModel alias for backward compatibility within the app
export type LlmModel = LlmModelResponseDto;

@Injectable({ providedIn: 'root' })
export class LlmModelService {
  private readonly http = inject(HttpClient);

  getActiveModels(): Observable<LlmModel[]> {
    return this.http.get<LlmModel[]>('/api/app/llm-models');
  }
}
