import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, shareReplay, retry, catchError, of } from 'rxjs';
import type { ProviderTypeDto } from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class ProviderTypeService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<ProviderTypeDto[]> | null = null;

  /** Cached signal for synchronous access after initial load */
  readonly types = signal<ProviderTypeDto[]>([]);

  /** Fetch provider types (cached — single request per session) */
  getProviderTypes(): Observable<ProviderTypeDto[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<ProviderTypeDto[]>('/api/admin/settings/llm-providers/types')
        .pipe(
          retry(2),
          tap((types) => {
            this.types.set(types);
          }),
          catchError(() => {
            this.cache$ = null;
            return of([] as ProviderTypeDto[]);
          }),
          shareReplay(1),
        );
    }
    return this.cache$;
  }

  /** Get display name for a provider key (uses cached data) */
  getDisplayName(providerKey: string): string {
    const found = this.types().find((t) => t.providerKey === providerKey);
    return found?.displayName ?? providerKey;
  }
}
