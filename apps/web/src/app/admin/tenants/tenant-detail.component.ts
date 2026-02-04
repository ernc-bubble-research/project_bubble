import { Component, DestroyRef, signal, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TenantService, Tenant } from '../../core/services/tenant.service';
import { InvitationService } from '../../core/services/invitation.service';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ImpersonateConfirmDialogComponent } from './impersonate-confirm-dialog.component';
import { InviteUserDialogComponent } from './invite-user-dialog.component';
import type { UpdateTenantPayload, InvitationResponseDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LucideAngularModule,
    StatusBadgeComponent,
    ImpersonateConfirmDialogComponent,
    InviteUserDialogComponent,
  ],
  selector: 'app-tenant-detail',
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  private readonly impersonationService = inject(ImpersonationService);
  private readonly toastService = inject(ToastService);
  private readonly invitationService = inject(InvitationService);
  private readonly destroyRef = inject(DestroyRef);

  tenant = signal<Tenant | null>(null);
  loading = signal(false);
  activeTab = signal<'general' | 'entitlements' | 'users' | 'usage' | 'audit'>('general');
  showImpersonateDialog = signal(false);
  impersonating = signal(false);
  copiedId = signal(false);
  saving = signal(false);

  // General tab form signals
  editName = signal('');
  editContact = signal('');
  editPlanTier = signal<'free' | 'starter' | 'professional' | 'enterprise'>('free');
  editResidency = signal('eu-west');

  // Entitlements tab form signals
  editMaxRuns = signal(50);
  editRetentionDays = signal(30);

  // Invitations
  showInviteDialog = signal(false);
  invitations = signal<InvitationResponseDto[]>([]);
  loadingInvitations = signal(false);

  // Suspend/Activate dialog
  showSuspendDialog = signal(false);

  readonly tabs = [
    { key: 'general' as const, label: 'General' },
    { key: 'entitlements' as const, label: 'Entitlements' },
    { key: 'users' as const, label: 'Users' },
    { key: 'usage' as const, label: 'Usage' },
    { key: 'audit' as const, label: 'Audit' },
  ];

  readonly planTierOptions = [
    { value: 'free' as const, label: 'Free' },
    { value: 'starter' as const, label: 'Starter' },
    { value: 'professional' as const, label: 'Professional' },
    { value: 'enterprise' as const, label: 'Enterprise' },
  ];

  readonly residencyOptions = [
    { value: 'eu-west', label: 'EU West' },
    { value: 'eu-central', label: 'EU Central' },
    { value: 'us-east', label: 'US East' },
  ];

  isGeneralDirty = computed(() => {
    const t = this.tenant();
    if (!t) return false;
    return (
      this.editName() !== t.name ||
      this.editContact() !== (t.primaryContact ?? '') ||
      this.editPlanTier() !== t.planTier ||
      this.editResidency() !== t.dataResidency
    );
  });

  isEntitlementsDirty = computed(() => {
    const t = this.tenant();
    if (!t) return false;
    return (
      this.editMaxRuns() !== t.maxMonthlyRuns ||
      this.editRetentionDays() !== t.assetRetentionDays
    );
  });

  resetDate = computed(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTenant(id);
    }
  }

  private loadTenant(id: string): void {
    this.loading.set(true);
    this.tenantService.getOne(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.syncFormFromTenant(tenant);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/tenants']);
      },
    });
  }

  private syncFormFromTenant(t: Tenant): void {
    this.editName.set(t.name);
    this.editContact.set(t.primaryContact ?? '');
    this.editPlanTier.set(t.planTier);
    this.editResidency.set(t.dataResidency);
    this.editMaxRuns.set(t.maxMonthlyRuns);
    this.editRetentionDays.set(t.assetRetentionDays);
  }

  setTab(tab: 'general' | 'entitlements' | 'users' | 'usage' | 'audit'): void {
    this.activeTab.set(tab);
    if (tab === 'users') {
      this.loadInvitations();
    }
  }

  // Invitation actions
  openInviteDialog(): void {
    this.showInviteDialog.set(true);
  }

  closeInviteDialog(): void {
    this.showInviteDialog.set(false);
  }

  onInviteSent(): void {
    this.showInviteDialog.set(false);
    this.toastService.show('Invitation sent successfully');
    this.loadInvitations();
  }

  loadInvitations(): void {
    const t = this.tenant();
    if (!t) return;

    this.loadingInvitations.set(true);
    this.invitationService.getAll(t.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (invitations) => {
        this.invitations.set(invitations);
        this.loadingInvitations.set(false);
      },
      error: () => {
        this.loadingInvitations.set(false);
        this.toastService.show('Failed to load invitations');
      },
    });
  }

  resendInvitation(id: string): void {
    const t = this.tenant();
    if (!t) return;

    this.invitationService.resend(t.id, id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.show('Invitation resent');
        this.loadInvitations();
      },
      error: () => {
        this.toastService.show('Failed to resend invitation');
      },
    });
  }

  revokeInvitation(id: string): void {
    const t = this.tenant();
    if (!t) return;

    this.invitationService.revoke(t.id, id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toastService.show('Invitation revoked');
        this.loadInvitations();
      },
      error: () => {
        this.toastService.show('Failed to revoke invitation');
      },
    });
  }

  // General tab actions
  saveGeneral(): void {
    const t = this.tenant();
    if (!t || !this.isGeneralDirty()) return;

    const payload: UpdateTenantPayload = {};
    if (this.editName() !== t.name) payload.name = this.editName();
    if (this.editContact() !== (t.primaryContact ?? '')) {
      payload.primaryContact = this.editContact() || null;
    }
    if (this.editPlanTier() !== t.planTier) payload.planTier = this.editPlanTier();
    if (this.editResidency() !== t.dataResidency) payload.dataResidency = this.editResidency();

    this.saving.set(true);
    this.tenantService.update(t.id, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.tenant.set(updated);
        this.syncFormFromTenant(updated);
        this.saving.set(false);
        this.toastService.show('Tenant updated successfully');
      },
      error: () => {
        this.saving.set(false);
        this.toastService.show('Failed to update tenant');
      },
    });
  }

  cancelGeneral(): void {
    const t = this.tenant();
    if (t) {
      this.editName.set(t.name);
      this.editContact.set(t.primaryContact ?? '');
      this.editPlanTier.set(t.planTier);
      this.editResidency.set(t.dataResidency);
    }
  }

  // Entitlements tab actions
  saveEntitlements(): void {
    const t = this.tenant();
    if (!t || !this.isEntitlementsDirty()) return;

    const payload: UpdateTenantPayload = {};
    if (this.editMaxRuns() !== t.maxMonthlyRuns) payload.maxMonthlyRuns = this.editMaxRuns();
    if (this.editRetentionDays() !== t.assetRetentionDays) payload.assetRetentionDays = this.editRetentionDays();

    this.saving.set(true);
    this.tenantService.update(t.id, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.tenant.set(updated);
        this.syncFormFromTenant(updated);
        this.saving.set(false);
        this.toastService.show('Entitlements updated successfully');
      },
      error: () => {
        this.saving.set(false);
        this.toastService.show('Failed to update entitlements');
      },
    });
  }

  onMaxRunsInput(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    this.editMaxRuns.set(isNaN(val) ? 0 : val);
  }

  onRetentionDaysInput(event: Event): void {
    const val = +(event.target as HTMLInputElement).value;
    this.editRetentionDays.set(isNaN(val) ? 1 : val);
  }

  cancelEntitlements(): void {
    const t = this.tenant();
    if (t) {
      this.editMaxRuns.set(t.maxMonthlyRuns);
      this.editRetentionDays.set(t.assetRetentionDays);
    }
  }

  // Suspend/Activate
  openSuspendDialog(): void {
    this.showSuspendDialog.set(true);
  }

  closeSuspendDialog(): void {
    this.showSuspendDialog.set(false);
  }

  confirmSuspendToggle(): void {
    const t = this.tenant();
    if (!t) return;

    const newStatus = t.status === 'active' ? 'suspended' : 'active';
    this.showSuspendDialog.set(false);
    this.saving.set(true);

    this.tenantService.update(t.id, { status: newStatus }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.tenant.set(updated);
        this.syncFormFromTenant(updated);
        this.saving.set(false);
        this.toastService.show(
          newStatus === 'suspended' ? 'Tenant suspended' : 'Tenant activated',
        );
      },
      error: () => {
        this.saving.set(false);
        this.toastService.show('Failed to update tenant status');
      },
    });
  }

  // Impersonation
  openImpersonateDialog(): void {
    this.showImpersonateDialog.set(true);
  }

  closeImpersonateDialog(): void {
    this.showImpersonateDialog.set(false);
  }

  onConfirmImpersonate(): void {
    const t = this.tenant();
    if (!t) return;

    this.impersonating.set(true);
    this.showImpersonateDialog.set(false);

    this.impersonationService.impersonate(t.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.impersonationService.storeImpersonation(response.token, response.tenant);
        this.impersonationService.startInactivityTimer();
        this.router.navigate(['/app/workflows']);
      },
      error: () => {
        this.impersonating.set(false);
        this.toastService.show('Failed to start impersonation. The tenant may be suspended or not found.');
      },
    });
  }

  copyTenantId(): void {
    const t = this.tenant();
    if (!t) return;
    navigator.clipboard.writeText(t.id).then(() => {
      this.copiedId.set(true);
      setTimeout(() => this.copiedId.set(false), 2000);
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/tenants']);
  }
}
