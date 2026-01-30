import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ImpersonationService } from '../../../core/services/impersonation.service';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-impersonation-banner',
  templateUrl: './impersonation-banner.component.html',
  styleUrl: './impersonation-banner.component.scss',
})
export class ImpersonationBannerComponent {
  readonly impersonationService = inject(ImpersonationService);

  get tenantName(): string {
    return this.impersonationService.impersonatedTenant()?.name ?? '';
  }

  exit(): void {
    this.impersonationService.exitImpersonation();
  }
}
