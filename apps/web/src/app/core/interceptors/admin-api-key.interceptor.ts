import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const adminApiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/api/admin/')) {
    const cloned = req.clone({
      setHeaders: { 'x-admin-api-key': environment.adminApiKey },
    });
    return next(cloned);
  }
  return next(req);
};
