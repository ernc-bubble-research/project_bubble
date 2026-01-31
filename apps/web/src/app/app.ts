import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ImpersonationBannerComponent } from './shared/components/impersonation-banner/impersonation-banner.component';
import { ImpersonationService } from './core/services/impersonation.service';
import { ToastService } from './core/services/toast.service';

@Component({
  imports: [RouterModule, ImpersonationBannerComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  readonly impersonationService = inject(ImpersonationService);
  readonly toastService = inject(ToastService);
}
