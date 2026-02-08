import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Settings, X, Eye, Globe, Shield, Users, Archive, RefreshCw,
  AlertCircle, Loader2, Link,
} from 'lucide-angular';
import { WorkflowSettingsModalComponent, type WorkflowSettingsTarget } from './workflow-settings-modal.component';
import type { WorkflowTemplateResponseDto, WorkflowChainResponseDto, Tenant } from '@project-bubble/shared';

describe('[P0] WorkflowSettingsModalComponent', () => {
  let component: WorkflowSettingsModalComponent;
  let fixture: ComponentFixture<WorkflowSettingsModalComponent>;
  let httpMock: HttpTestingController;

  const mockTemplate: WorkflowTemplateResponseDto = {
    id: 'template-1', tenantId: 'tenant-1', name: 'Test Workflow', description: 'A test workflow',
    visibility: 'public', allowedTenants: null, status: 'published', currentVersionId: 'v1',
    createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(),
  };

  const mockChain: WorkflowChainResponseDto = {
    id: 'chain-1', tenantId: 'tenant-1', name: 'Test Chain', description: 'A test chain',
    visibility: 'public', allowedTenants: null, status: 'draft', definition: { steps: [] },
    createdBy: 'user-1', createdAt: new Date(), updatedAt: new Date(),
  };

  const mockTenants: Tenant[] = [
    { id: 'tenant-a', name: 'Acme Corp', status: 'active', primaryContact: null, planTier: 'starter', dataResidency: 'us-east', maxMonthlyRuns: 100, assetRetentionDays: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'tenant-b', name: 'Beta Inc', status: 'active', primaryContact: null, planTier: 'professional', dataResidency: 'us-east', maxMonthlyRuns: 500, assetRetentionDays: 90, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: '00000000-0000-0000-0000-000000000000', name: 'Bubble Admin', status: 'active', primaryContact: null, planTier: 'enterprise', dataResidency: 'us-east', maxMonthlyRuns: 0, assetRetentionDays: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  const templateTarget: WorkflowSettingsTarget = { type: 'template', data: mockTemplate };
  const chainTarget: WorkflowSettingsTarget = { type: 'chain', data: mockChain };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowSettingsModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS, multi: true,
          useValue: new LucideIconProvider({ Settings, X, Eye, Globe, Shield, Users, Archive, RefreshCw, AlertCircle, Loader2, Link }),
        },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    httpMock.verify();
  });

  function createComponent(target: WorkflowSettingsTarget): void {
    fixture = TestBed.createComponent(WorkflowSettingsModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('target', target);
    fixture.detectChanges();
    const tenantReq = httpMock.expectOne('/api/admin/tenants');
    tenantReq.flush(mockTenants);
    fixture.detectChanges();
  }

  describe('rendering', () => {
    it('[3.8-UNIT-005] [P0] Given a template target, when rendered, then shows Template Settings title', () => {
      createComponent(templateTarget);
      expect(fixture.nativeElement.querySelector('.dialog-title').textContent).toContain('Template Settings');
    });

    it('[3.8-UNIT-005a] [P0] Given a chain target, when rendered, then shows Chain Settings title', () => {
      createComponent(chainTarget);
      expect(fixture.nativeElement.querySelector('.dialog-title').textContent).toContain('Chain Settings');
    });

    it('[3.8-UNIT-005b] [P1] Given a target, when rendered, then shows workflow name', () => {
      createComponent(templateTarget);
      expect(fixture.nativeElement.querySelector('[data-testid="settings-workflow-name"]').textContent).toContain('Test Workflow');
    });

    it('[3.8-UNIT-005c] [P1] Given a target, when rendered, then shows status badge', () => {
      createComponent(templateTarget);
      expect(fixture.nativeElement.querySelector('[data-testid="settings-status-badge"]').textContent.trim()).toBe('PUBLISHED');
    });
  });

  describe('visibility controls', () => {
    it('[3.8-UNIT-006] [P0] Given a public template, when rendered, then public radio is selected', () => {
      createComponent(templateTarget);
      const publicRadio = fixture.nativeElement.querySelector('[data-testid="visibility-public"]') as HTMLInputElement;
      expect(publicRadio.checked).toBe(true);
    });

    it('[3.8-UNIT-006a] [P0] Given a public template, when private selected, then shows tenant selector', () => {
      createComponent(templateTarget);
      (fixture.nativeElement.querySelector('[data-testid="visibility-private"]') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-tenant-section"]')).toBeTruthy();
    });

    it('[3.8-UNIT-006b] [P0] Given visibility is public, when rendered, then tenant selector is hidden', () => {
      createComponent(templateTarget);
      expect(fixture.nativeElement.querySelector('[data-testid="settings-tenant-section"]')).toBeFalsy();
    });
  });

  describe('tenant selection', () => {
    it('[3.8-UNIT-007] [P0] Given tenants loaded, when rendered in private mode, then shows non-admin tenants', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: ['tenant-a'] } as WorkflowTemplateResponseDto };
      createComponent(target);
      expect(fixture.nativeElement.querySelectorAll('.tenant-checkbox').length).toBe(2);
    });

    it('[3.8-UNIT-007a] [P0] Given private mode, when tenant toggled, then updates allowedTenants', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: [] } as WorkflowTemplateResponseDto };
      createComponent(target);
      component.onTenantToggle('tenant-a');
      expect(component.form.controls.allowedTenants.value).toContain('tenant-a');
      component.onTenantToggle('tenant-a');
      expect(component.form.controls.allowedTenants.value).not.toContain('tenant-a');
    });

    it('[3.8-UNIT-007b] [P1] Given private mode, when isTenantSelected called, then returns correct boolean', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: ['tenant-a'] } as WorkflowTemplateResponseDto };
      createComponent(target);
      expect(component.isTenantSelected('tenant-a')).toBe(true);
      expect(component.isTenantSelected('tenant-b')).toBe(false);
    });
  });

  describe('validation', () => {
    it('[3.8-UNIT-008] [P0] Given private visibility with no tenants, when save clicked, then shows error', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: [] } as WorkflowTemplateResponseDto };
      createComponent(target);
      component.onSave();
      fixture.detectChanges();
      expect(component.error()).toContain('at least one tenant');
      expect(fixture.nativeElement.querySelector('[data-testid="settings-error"]')).toBeTruthy();
    });
  });

  describe('save template', () => {
    it('[3.8-UNIT-009] [P0] Given public template, when save clicked, then sends PATCH with visibility', () => {
      createComponent(templateTarget);
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.form.markAsDirty();
      component.onSave();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ visibility: 'public', allowedTenants: [] });
      req.flush({ ...mockTemplate });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-009a] [P0] Given private template with tenants, when save clicked, then includes allowedTenants', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: ['tenant-a'] } as WorkflowTemplateResponseDto };
      createComponent(target);
      component.form.markAsDirty();
      component.onSave();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.body).toEqual({ visibility: 'private', allowedTenants: ['tenant-a'] });
      req.flush({ ...mockTemplate });
    });

    it('[3.8-UNIT-009b] [P1] Given no changes made, when save clicked, then closes without API call', () => {
      // Given — form starts pristine after effect patches values
      createComponent(templateTarget);
      const savedSpy = jest.spyOn(component.saved, 'emit');

      // When — save without making any changes
      component.onSave();

      // Then — no HTTP request, just emit saved
      expect(savedSpy).toHaveBeenCalled();
    });
  });

  describe('save chain', () => {
    it('[3.8-UNIT-010] [P0] Given chain, when save clicked, then sends PUT with visibility', () => {
      createComponent(chainTarget);
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.form.markAsDirty();
      component.onSave();
      const req = httpMock.expectOne('/api/admin/workflow-chains/chain-1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ visibility: 'public', allowedTenants: [] });
      req.flush({ ...mockChain });
      expect(savedSpy).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('[3.8-UNIT-012] [P0] Given modal open, when cancel clicked, then emits cancelled', () => {
      createComponent(templateTarget);
      const cancelSpy = jest.spyOn(component.cancelled, 'emit');
      component.onCancel();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-012a] [P1] Given modal open, when backdrop clicked, then emits cancelled', () => {
      createComponent(templateTarget);
      const cancelSpy = jest.spyOn(component.cancelled, 'emit');
      fixture.nativeElement.querySelector('[data-testid="settings-modal-backdrop"]').click();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-012b] [P1] Given modal open, when Escape key pressed, then emits cancelled', () => {
      createComponent(templateTarget);
      const cancelSpy = jest.spyOn(component.cancelled, 'emit');
      const backdrop = fixture.nativeElement.querySelector('[data-testid="settings-modal-backdrop"]');
      backdrop.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('[3.8-UNIT-013] [P1] Given save fails, when HTTP error, then shows error message', () => {
      createComponent(templateTarget);
      component.form.markAsDirty();
      component.onSave();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      req.flush({ message: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(component.error()).toContain('Invalid data');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('loading state', () => {
    it('[3.8-UNIT-014] [P1] Given save in progress, when submitting, then buttons are disabled', () => {
      createComponent(templateTarget);
      component.form.markAsDirty();
      component.onSave();
      fixture.detectChanges();
      expect(component.submitting()).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="settings-save-btn"]').disabled).toBe(true);
      // Cleanup
      httpMock.expectOne('/api/admin/workflow-templates/template-1').flush({ ...mockTemplate });
    });
  });

  describe('visibility change', () => {
    it('[3.8-UNIT-015] [P1] Given private with tenants, when switched to public, then clears allowedTenants', () => {
      const target: WorkflowSettingsTarget = { type: 'template', data: { ...mockTemplate, visibility: 'private', allowedTenants: ['tenant-a'] } as WorkflowTemplateResponseDto };
      createComponent(target);
      expect(component.form.controls.allowedTenants.value).toEqual(['tenant-a']);
      component.form.controls.visibility.setValue('public');
      component.onVisibilityChange();
      expect(component.form.controls.allowedTenants.value).toEqual([]);
    });
  });
});
