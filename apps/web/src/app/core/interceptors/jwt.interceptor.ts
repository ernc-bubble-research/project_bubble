import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Skip if the request already has an admin API key header (backward compat)
  if (req.headers.has('x-admin-api-key')) {
    return next(req);
  }

  // Prefer impersonation token when active (stored by ImpersonationService).
  // Cannot inject ImpersonationService here — it uses HttpClient, which would
  // create a circular dependency with this HTTP interceptor.
  const impersonationToken = localStorage.getItem('impersonation_token');
  if (impersonationToken) {
    return next(
      req.clone({ setHeaders: { Authorization: `Bearer ${impersonationToken}` } }),
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
