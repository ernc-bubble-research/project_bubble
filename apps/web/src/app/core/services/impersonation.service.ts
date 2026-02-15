import { Injectable, inject, signal, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import type { ImpersonateResponseDto } from '@project-bubble/shared';

const IMPERSONATION_TOKEN_KEY = 'impersonation_token';
const IMPERSONATION_TENANT_KEY = 'impersonation_tenant';
const IMPERSONATION_SESSION_KEY = 'impersonation_session_id';
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
const WARNING_MS = TIMEOUT_MS - 60_000; // 29 minutes — warning 60s before auto-logout

@Injectable({ providedIn: 'root' })
export class ImpersonationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  /**
   * Guard flag to prevent re-entrant exit calls (e.g., multiple concurrent 401 responses).
   * Set to true at the start of exitImpersonation(), reset after navigation completes.
   */
  private _exiting = false;

  private readonly _isImpersonating = signal(this.hasStoredImpersonation());
  private readonly _tenant = signal<{ id: string; name: string } | null>(this.getStoredTenant());
  private readonly _toastMessage = signal<string | null>(null);

  readonly isImpersonating = this._isImpersonating.asReadonly();
  readonly impersonatedTenant = this._tenant.asReadonly();
  readonly toastMessage = this._toastMessage.asReadonly();

  /** Whether an exit is already in progress (for interceptor duplicate guard). */
  get isExiting(): boolean {
    return this._exiting;
  }

  impersonate(tenantId: string): Observable<ImpersonateResponseDto> {
    return this.http.post<ImpersonateResponseDto>(
      `/api/admin/tenants/${tenantId}/impersonate`,
      {},
    );
  }

  storeImpersonation(token: string, tenant: { id: string; name: string }, sessionId: string): void {
    localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
    localStorage.setItem(IMPERSONATION_TENANT_KEY, JSON.stringify(tenant));
    localStorage.setItem(IMPERSONATION_SESSION_KEY, sessionId);
    this._exiting = false;
    this._isImpersonating.set(true);
    this._tenant.set(tenant);
  }

  exitImpersonation(): void {
    // Duplicate guard — prevent re-entrant calls from concurrent 401s
    if (this._exiting) return;
    this._exiting = true;

    this.stopInactivityTimer();

    // Read sessionId BEFORE clearing impersonation token
    const sessionId = localStorage.getItem(IMPERSONATION_SESSION_KEY);

    // Clear impersonation token FIRST — HTTP interceptor falls back to admin JWT.
    // CRITICAL: This must happen before the session-end POST below, because if that
    // POST itself returns a 401, the interceptor checks localStorage for the
    // impersonation token. Since it's already cleared, the 401 won't trigger
    // re-entry into exitImpersonation(). The _exiting flag is a secondary guard.
    localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    localStorage.removeItem(IMPERSONATION_SESSION_KEY);

    // Call session-end API with admin JWT (fire-and-forget)
    if (sessionId) {
      this.http.post('/api/admin/tenants/impersonation/end', { sessionId }).subscribe({
        error: (err: unknown) => {
          // Fire-and-forget — failure does not block exit, but log for debugging
          console.warn('Failed to close impersonation session on server:', err);
        },
      });
    }

    // Clear remaining state and navigate
    localStorage.removeItem(IMPERSONATION_TENANT_KEY);
    this._isImpersonating.set(false);
    this._tenant.set(null);
    this.router.navigate(['/admin/dashboard']).finally(() => {
      this._exiting = false;
    });
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
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  showToast(message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this._toastMessage.set(message);
    this.toastTimer = setTimeout(() => {
      this._toastMessage.set(null);
      this.toastTimer = null;
    }, 5000);
  }

  dismissToast(): void {
    this._toastMessage.set(null);
  }

  private resetTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }
    this.ngZone.runOutsideAngular(() => {
      // Pre-warning toast at T-60s before auto-logout
      this.warningTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.showToast('Session will expire in 1 minute due to inactivity.');
        });
      }, WARNING_MS);

      // Auto-logout at TIMEOUT_MS
      this.inactivityTimer = setTimeout(() => {
        this.ngZone.run(() => this.onTimeout());
      }, TIMEOUT_MS);
    });
  }

  private onTimeout(): void {
    this.exitImpersonation();
    this.showToast('Impersonation session expired due to inactivity.');
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
