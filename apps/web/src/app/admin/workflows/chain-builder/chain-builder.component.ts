import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { ChainDefinition, ChainStep } from '@project-bubble/shared';
import { validateChainSchema } from '@project-bubble/shared/web';
import { WorkflowChainService } from '../../../core/services/workflow-chain.service';
import { ToastService } from '../../../core/services/toast.service';
import { HasUnsavedChanges } from '../../../core/guards/has-unsaved-changes.interface';
import { ChainMetadataSectionComponent } from './chain-metadata-section.component';
import { ChainStepsListComponent } from './chain-steps-list.component';
import { ChainAddStepComponent } from './chain-add-step.component';
import { ChainInputMappingComponent } from './chain-input-mapping.component';
import { ChainDataFlowComponent } from './chain-data-flow.component';
import { ChainVisibilitySettingsComponent } from './chain-visibility-settings.component';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ChainMetadataSectionComponent,
    ChainStepsListComponent,
    ChainAddStepComponent,
    ChainInputMappingComponent,
    ChainDataFlowComponent,
    ChainVisibilitySettingsComponent,
    InfoTooltipComponent,
  ],
  selector: 'app-chain-builder',
  templateUrl: './chain-builder.component.html',
  styleUrl: './chain-builder.component.scss',
})
export class ChainBuilderComponent implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chainService = inject(WorkflowChainService);
  private readonly toast = inject(ToastService);

  editMode = signal(false);
  chainId = signal<string | null>(null);
  isDirty = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  validationErrors = signal<string[]>([]);

  chainState = signal<Partial<ChainDefinition>>({
    metadata: { name: '', description: '' },
    steps: [],
  });

  visibility = signal<'public' | 'private'>('public');
  allowedTenants = signal<string[]>([]);

  isValid = computed(() => {
    const state = this.chainState();
    const result = validateChainSchema(state as ChainDefinition);
    return result.valid;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode.set(true);
      this.chainId.set(id);
      this.loadExistingChain(id);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  updateMetadata(metadata: ChainDefinition['metadata']): void {
    this.chainState.update((state) => ({ ...state, metadata }));
    this.isDirty.set(true);
  }

  updateSteps(steps: ChainDefinition['steps']): void {
    this.chainState.update((state) => ({ ...state, steps }));
    this.isDirty.set(true);
  }

  addStep(step: ChainStep): void {
    const currentSteps = this.chainState().steps || [];
    this.updateSteps([...currentSteps, step]);
  }

  updateVisibility(visibility: 'public' | 'private'): void {
    this.visibility.set(visibility);
    this.isDirty.set(true);
  }

  updateAllowedTenants(tenants: string[]): void {
    this.allowedTenants.set(tenants);
    this.isDirty.set(true);
  }

  save(): void {
    const state = this.chainState();
    const result = validateChainSchema(state as ChainDefinition);

    if (!result.valid) {
      this.validationErrors.set(result.errors);
      return;
    }

    this.validationErrors.set([]);
    this.isSaving.set(true);
    this.saveError.set(null);

    const definition = state as ChainDefinition;

    if (this.editMode() && this.chainId()) {
      this.updateChain(definition);
    } else {
      this.createChain(definition);
    }
  }

  private createChain(definition: ChainDefinition): void {
    const dto = {
      name: definition.metadata.name,
      description: definition.metadata.description,
      definition: definition as unknown as Record<string, unknown>,
      visibility: this.visibility(),
      allowedTenants: this.visibility() === 'private' ? this.allowedTenants() : undefined,
    };

    this.chainService.create(dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.toast.show('Workflow chain created successfully');
        this.router.navigate(['/admin/workflows']);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.saveError.set(err?.error?.message || 'Failed to create workflow chain');
      },
    });
  }

  private updateChain(definition: ChainDefinition): void {
    const id = this.chainId();
    if (!id) return;

    const dto = {
      name: definition.metadata.name,
      description: definition.metadata.description,
      definition: definition as unknown as Record<string, unknown>,
      visibility: this.visibility(),
      allowedTenants: this.visibility() === 'private' ? this.allowedTenants() : undefined,
    };

    this.chainService.update(id, dto).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isDirty.set(false);
        this.toast.show('Workflow chain updated successfully');
        this.router.navigate(['/admin/workflows']);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isSaving.set(false);
        this.saveError.set(err?.error?.message || 'Failed to update workflow chain');
      },
    });
  }

  private loadExistingChain(id: string): void {
    this.chainService.getById(id).subscribe({
      next: (chain) => {
        this.chainState.set(chain.definition as unknown as ChainDefinition);
        this.visibility.set(chain.visibility as 'public' | 'private');
        this.allowedTenants.set(chain.allowedTenants || []);
      },
      error: () => {
        this.saveError.set('Failed to load workflow chain');
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/workflows']);
  }
}
