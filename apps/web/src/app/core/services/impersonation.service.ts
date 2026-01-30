import { Injectable, inject, signal, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ImpersonateResponseDto } from '@project-bubble/shared';

const IMPERSONATION_TOKEN_KEY = 'impersonation_token';
const IMPERSONATION_TENANT_KEY = 'impersonation_tenant';
const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  private readonly _isImpersonating = signal(this.hasStoredImpersonation());
  private readonly _tenant = signal<{ id: string; name: string } | null>(this.getStoredTenant());
  private readonly _toastMessage = signal<string | null>(null);

  readonly isImpersonating = this._isImpersonating.asReadonly();
  readonly impersonatedTenant = this._tenant.asReadonly();
  readonly toastMessage = this._toastMessage.asReadonly();

  impersonate(tenantId: string): Observable<ImpersonateResponseDto> {
    return this.http.post<ImpersonateResponseDto>(
      `/api/admin/tenants/${tenantId}/impersonate`,
      {},
    );
  }

  storeImpersonation(token: string, tenant: { id: string; name: string }): void {
    localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
    localStorage.setItem(IMPERSONATION_TENANT_KEY, JSON.stringify(tenant));
    this._isImpersonating.set(true);
    this._tenant.set(tenant);
  }

  exitImpersonation(): void {
    this.stopInactivityTimer();
    localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    localStorage.removeItem(IMPERSONATION_TENANT_KEY);
    this._isImpersonating.set(false);
    this._tenant.set(null);
    this.router.navigate(['/admin/dashboard']);
  }

  startInactivityTimer(): void {
    this.stopInactivityTimer();

    this.abortController = new AbortController();
    const signal = this.abortController.signal;
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];

    events.forEach((event) => {
      document.addEventListener(
        event,
        () => this.resetTimer(),
        { signal, passive: true },
      );
    });

    this.resetTimer();
  }

  stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  showToast(message: string): void {
    this._toastMessage.set(message);
    setTimeout(() => this._toastMessage.set(null), 5000);
  }

  dismissToast(): void {
    this._toastMessage.set(null);
  }

  private resetTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.ngZone.runOutsideAngular(() => {
      this.inactivityTimer = setTimeout(() => {
        this.ngZone.run(() => this.onTimeout());
      }, TIMEOUT_MS);
    });
  }

  private onTimeout(): void {
    this.exitImpersonation();
    this.showToast('Impersonation session expired due to inactivity');
  }

  private hasStoredImpersonation(): boolean {
    return !!localStorage.getItem(IMPERSONATION_TOKEN_KEY);
  }

  private getStoredTenant(): { id: string; name: string } | null {
    const raw = localStorage.getItem(IMPERSONATION_TENANT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
