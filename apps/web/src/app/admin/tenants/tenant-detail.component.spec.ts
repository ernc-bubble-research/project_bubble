import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertTriangle,
  Copy,
  ArrowLeft,
  X,
  Info,
  Archive,
  Trash2,
} from 'lucide-angular';
import { TenantDetailComponent } from './tenant-detail.component';
import { TenantService } from '../../core/services/tenant.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('TenantDetailComponent [P2]', () => {
  let component: TenantDetailComponent;
  let fixture: ComponentFixture<TenantDetailComponent>;
  let tenantServiceMock: Record<string, jest.Mock>;

  const mockTenant = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Corp',
    status: 'active' as const,
    primaryContact: null,
    planTier: 'free' as const,
    dataResidency: 'eu-west',
    maxMonthlyRuns: 50,
    assetRetentionDays: 30,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    tenantServiceMock = {
      getOne: jest.fn().mockReturnValue(of(mockTenant)),
      update: jest.fn().mockReturnValue(of(mockTenant)),
      archive: jest.fn().mockReturnValue(of({ ...mockTenant, status: 'archived' })),
      unarchive: jest.fn().mockReturnValue(of({ ...mockTenant, status: 'active' })),
      hardDelete: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [TenantDetailComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => mockTenant.id } },
          },
        },
        { provide: TenantService, useValue: tenantServiceMock },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            AlertTriangle,
            Copy,
            ArrowLeft,
            X,
            Info,
            Archive,
            Trash2,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('[1H.1-UNIT-001] should create', () => {
    expect(component).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should load tenant on init', () => {
    expect(component.tenant()).toEqual(mockTenant);
  });

  it('[1H.1-UNIT-003] should sync form signals from loaded tenant', () => {
    expect(component.editName()).toBe('Acme Corp');
    expect(component.editContact()).toBe('');
    expect(component.editPlanTier()).toBe('free');
    expect(component.editResidency()).toBe('eu-west');
    expect(component.editMaxRuns()).toBe(50);
    expect(component.editRetentionDays()).toBe(30);
  });

  it('[1H.1-UNIT-004] should render breadcrumb with tenant name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.breadcrumb-current')?.textContent).toContain(
      'Acme Corp'
    );
  });

  it('[1H.1-UNIT-005] should render header card with tenant name and status', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.tenant-name')?.textContent).toContain(
      'Acme Corp'
    );
    expect(el.querySelector('app-status-badge')).toBeTruthy();
  });

  it('[1H.1-UNIT-006] should render Impersonate button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const impersonateBtn = el.querySelector('.btn-danger-outline');
    expect(impersonateBtn).toBeTruthy();
    expect(impersonateBtn?.textContent).toContain('Impersonate');
  });

  it('[1H.1-UNIT-007] should render tab navigation with 5 tabs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const tabs = el.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(5);
    expect(tabs[0].textContent?.trim()).toBe('General');
  });

  it('[1H.1-UNIT-008] should show General tab content by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.form-card')).toBeTruthy();
  });

  it('[1H.1-UNIT-009] should have Save Changes button disabled when form is pristine', () => {
    const el: HTMLElement = fixture.nativeElement;
    const saveBtn = el.querySelector('.btn-primary') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('[1H.1-UNIT-010] should detect dirty state when name is changed', () => {
    expect(component.isGeneralDirty()).toBe(false);
    component.editName.set('New Name');
    expect(component.isGeneralDirty()).toBe(true);
  });

  it('[1H.1-UNIT-011] should reset form on cancelGeneral', () => {
    component.editName.set('Changed');
    expect(component.isGeneralDirty()).toBe(true);
    component.cancelGeneral();
    expect(component.editName()).toBe('Acme Corp');
    expect(component.isGeneralDirty()).toBe(false);
  });

  it('[1H.1-UNIT-012] should call tenantService.update on saveGeneral', () => {
    const updatedTenant = { ...mockTenant, name: 'New Name' };
    tenantServiceMock['update'].mockReturnValue(of(updatedTenant));

    component.editName.set('New Name');
    component.saveGeneral();

    expect(tenantServiceMock['update']).toHaveBeenCalledWith(
      mockTenant.id,
      { name: 'New Name' },
    );
  });

  it('[1H.1-UNIT-013] should open impersonate dialog when button clicked', () => {
    expect(component.showImpersonateDialog()).toBe(false);
    component.openImpersonateDialog();
    expect(component.showImpersonateDialog()).toBe(true);
  });

  it('[1H.1-UNIT-014] should render Suspend button for active tenant', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = Array.from(el.querySelectorAll('.header-actions .btn'));
    const suspendBtn = buttons.find((b) => b.textContent?.trim() === 'Suspend');
    expect(suspendBtn).toBeTruthy();
  });

  it('[1H.1-UNIT-015] should open suspend dialog', () => {
    expect(component.showSuspendDialog()).toBe(false);
    component.openSuspendDialog();
    expect(component.showSuspendDialog()).toBe(true);
  });

  it('[1H.1-UNIT-016] should switch to entitlements tab', () => {
    component.setTab('entitlements');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.section-title')?.textContent).toContain('Run Quota');
  });

  it('[1H.1-UNIT-017] should detect entitlements dirty state', () => {
    expect(component.isEntitlementsDirty()).toBe(false);
    component.editMaxRuns.set(200);
    expect(component.isEntitlementsDirty()).toBe(true);
  });

  it('[1H.1-UNIT-018] should reset entitlements on cancelEntitlements', () => {
    component.editMaxRuns.set(200);
    expect(component.isEntitlementsDirty()).toBe(true);
    component.cancelEntitlements();
    expect(component.editMaxRuns()).toBe(50);
    expect(component.isEntitlementsDirty()).toBe(false);
  });

  it('[1H.1-UNIT-019] should call tenantService.update on saveEntitlements', () => {
    const updatedTenant = { ...mockTenant, maxMonthlyRuns: 200 };
    tenantServiceMock['update'].mockReturnValue(of(updatedTenant));

    component.editMaxRuns.set(200);
    component.saveEntitlements();

    expect(tenantServiceMock['update']).toHaveBeenCalledWith(
      mockTenant.id,
      { maxMonthlyRuns: 200 },
    );
  });

  // Story 1-13: Archive / Unarchive / Delete tests
  it('[1-13-UNIT-DET-001] should show Archive button for active tenant', () => {
    const el: HTMLElement = fixture.nativeElement;
    const archiveBtn = el.querySelector('[data-testid="archive-btn"]');
    expect(archiveBtn).toBeTruthy();
    expect(archiveBtn?.textContent).toContain('Archive');
  });

  it('[1-13-UNIT-DET-002] should show Suspend button for active tenant', () => {
    const el: HTMLElement = fixture.nativeElement;
    const suspendBtn = el.querySelector('[data-testid="suspend-toggle-btn"]');
    expect(suspendBtn).toBeTruthy();
    expect(suspendBtn?.textContent?.trim()).toBe('Suspend');
  });

  it('[1-13-UNIT-DET-003] should NOT show Delete button for active tenant', () => {
    const el: HTMLElement = fixture.nativeElement;
    const deleteBtn = el.querySelector('[data-testid="delete-btn"]');
    expect(deleteBtn).toBeNull();
  });

  it('[1-13-UNIT-DET-004] should NOT show Unarchive button for active tenant', () => {
    const el: HTMLElement = fixture.nativeElement;
    const unarchiveBtn = el.querySelector('[data-testid="unarchive-btn"]');
    expect(unarchiveBtn).toBeNull();
  });

  it('[1-13-UNIT-DET-005] should open archive confirmation dialog', () => {
    expect(component.showArchiveDialog()).toBe(false);
    component.openArchiveDialog();
    expect(component.showArchiveDialog()).toBe(true);
  });

  it('[1-13-UNIT-DET-006] should call tenantService.archive on confirmArchive', () => {
    component.confirmArchive();

    expect(tenantServiceMock['archive']).toHaveBeenCalledWith(mockTenant.id);
  });

  describe('archived tenant', () => {
    const archivedTenant = {
      ...mockTenant,
      status: 'archived' as const,
    };

    beforeEach(() => {
      tenantServiceMock['getOne'] = jest.fn().mockReturnValue(of(archivedTenant));
      fixture = TestBed.createComponent(TenantDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('[1-13-UNIT-DET-007] should show Unarchive button for archived tenant', () => {
      const el: HTMLElement = fixture.nativeElement;
      const unarchiveBtn = el.querySelector('[data-testid="unarchive-btn"]');
      expect(unarchiveBtn).toBeTruthy();
      expect(unarchiveBtn?.textContent).toContain('Unarchive');
    });

    it('[1-13-UNIT-DET-008] should show Delete button for archived tenant', () => {
      const el: HTMLElement = fixture.nativeElement;
      const deleteBtn = el.querySelector('[data-testid="delete-btn"]');
      expect(deleteBtn).toBeTruthy();
      expect(deleteBtn?.textContent).toContain('Delete');
    });

    it('[1-13-UNIT-DET-009] should NOT show Suspend button for archived tenant', () => {
      const el: HTMLElement = fixture.nativeElement;
      const suspendBtn = el.querySelector('[data-testid="suspend-toggle-btn"]');
      expect(suspendBtn).toBeNull();
    });

    it('[1-13-UNIT-DET-010] should NOT show Archive button for archived tenant', () => {
      const el: HTMLElement = fixture.nativeElement;
      const archiveBtn = el.querySelector('[data-testid="archive-btn"]');
      expect(archiveBtn).toBeNull();
    });

    it('[1-13-UNIT-DET-011] should disable Impersonate for archived tenant', () => {
      const el: HTMLElement = fixture.nativeElement;
      const impersonateBtn = el.querySelector('[data-testid="impersonate-btn"]') as HTMLButtonElement;
      expect(impersonateBtn?.disabled).toBe(true);
    });

    it('[1-13-UNIT-DET-012] should open delete dialog', () => {
      expect(component.showDeleteDialog()).toBe(false);
      component.openDeleteDialog();
      expect(component.showDeleteDialog()).toBe(true);
    });

    it('[1-13-UNIT-DET-013] should call tenantService.unarchive on confirmUnarchive', () => {
      component.confirmUnarchive();

      expect(tenantServiceMock['unarchive']).toHaveBeenCalledWith(archivedTenant.id);
    });
  });
});
