import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { appRoutes } from './app.routes';
import { adminApiKeyInterceptor } from './core/interceptors/admin-api-key.interceptor';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import {
  LucideIconProvider,
  LUCIDE_ICONS,
} from 'lucide-angular';
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  Settings,
  AlertTriangle,
  Copy,
  ArrowLeft,
  X,
  Clock,
  BarChart3,
  CircleCheck,
  CircleX,
  Users,
  Menu,
  Info,
  Eye,
  EyeOff,
  LogOut,
  UserPlus,
  Send,
  RefreshCw,
  XCircle,
  AlertCircle,
} from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([jwtInterceptor, adminApiKeyInterceptor])),
    {
      provide: LUCIDE_ICONS,
      multi: true,
      useValue: new LucideIconProvider({
        LayoutDashboard,
        Building2,
        GitBranch,
        Settings,
        AlertTriangle,
        Copy,
        ArrowLeft,
        X,
        Clock,
        BarChart3,
        CircleCheck,
        CircleX,
        Users,
        Menu,
        Info,
        Eye,
        EyeOff,
        LogOut,
        UserPlus,
        Send,
        RefreshCw,
        XCircle,
        AlertCircle,
      }),
    },
  ],
};
