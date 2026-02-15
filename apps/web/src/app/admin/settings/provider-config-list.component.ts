import {
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import {
  LlmProviderService,
  type LlmProviderConfig,
} from '../../core/services/llm-provider.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-provider-config-list',
  templateUrl: './provider-config-list.component.html',
  styleUrl: './provider-config-list.component.scss',
})
export class ProviderConfigListComponent {
  private readonly providerService = inject(LlmProviderService);
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly configs = signal<LlmProviderConfig[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);

  readonly addConfigClicked = output<void>();
  readonly editConfigClicked = output<LlmProviderConfig>();

  readonly isEmpty = computed(
    () => this.configs().length === 0 && !this.loading(),
  );

  constructor() {
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.providerService
      .getAllConfigs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (configs) => {
          this.configs.set(configs);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            'Failed to load provider configurations. Please try again.',
          );
          this.loading.set(false);
        },
      });
  }

  onAddConfig(): void {
    this.addConfigClicked.emit();
  }

  onEditConfig(config: LlmProviderConfig): void {
    this.editConfigClicked.emit(config);
  }

  onToggleActive(config: LlmProviderConfig): void {
    if (this.togglingId()) return;

    this.togglingId.set(config.id);

    this.providerService
      .updateConfig(config.id, { isActive: !config.isActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.configs.update((list) =>
            list.map((c) => (c.id === updated.id ? updated : c)),
          );
          this.togglingId.set(null);
        },
        error: () => {
          this.error.set(
            'Failed to update provider status. Please try again.',
          );
          this.togglingId.set(null);
        },
      });
  }

  getProviderDisplayName(providerKey: string): string {
    return this.providerTypeService.getDisplayName(providerKey);
  }

  getCredentialSummary(
    maskedCredentials: Record<string, string> | null,
  ): string {
    if (!maskedCredentials) return 'No credentials';
    if (maskedCredentials['_status']) return maskedCredentials['_status'];
    const keys = Object.keys(maskedCredentials);
    return keys.length > 0 ? `${keys.length} field(s) configured` : 'No credentials';
  }
}
