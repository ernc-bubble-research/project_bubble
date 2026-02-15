import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, EMPTY, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ImpersonationService } from '../services/impersonation.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip if the request already has an admin API key header (backward compat)
  if (req.headers.has('x-admin-api-key')) {
    return next(req);
  }

  // Prefer impersonation token when active (stored by ImpersonationService).
  // We read localStorage directly to avoid eager injection of ImpersonationService
  // (which uses HttpClient, creating a potential circular dependency at construction time).
  const impersonationToken = localStorage.getItem('impersonation_token');
  if (impersonationToken) {
    // Lazy-inject ImpersonationService only when needed for 401 handling.
    // Angular resolves this on first access; no circular issue because the
    // interceptor function is already constructed by this point.
    const impersonationService = inject(ImpersonationService);

    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${impersonationToken}` } }),
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !impersonationService.isExiting) {
          // JWT expired or invalidated during impersonation — exit gracefully.
          // exitImpersonation() clears the impersonation token from localStorage
          // BEFORE firing the session-end POST, so if that POST also 401s the
          // interceptor won't re-enter (token already cleared + _exiting guard).
          impersonationService.exitImpersonation();
          impersonationService.showToast('Impersonation session has ended.');
          return EMPTY;
        }
        return throwError(() => error);
      }),
    );
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
    );
  }

  return next(req);
};
