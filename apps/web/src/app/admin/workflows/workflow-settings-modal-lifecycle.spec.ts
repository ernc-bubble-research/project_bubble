import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Settings, X, Eye, Globe, Shield, Users, Archive, RefreshCw,
  AlertCircle, Loader2, Link, Send, Undo2,
} from 'lucide-angular';
import { WorkflowSettingsModalComponent, type WorkflowSettingsTarget } from './workflow-settings-modal.component';
import type { WorkflowTemplateResponseDto, WorkflowChainResponseDto, Tenant } from '@project-bubble/shared';

describe('[P0] WorkflowSettingsModalComponent — Lifecycle', () => {
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

  const draftTemplate: WorkflowTemplateResponseDto = { ...mockTemplate, status: 'draft' };
  const archivedTemplate: WorkflowTemplateResponseDto = { ...mockTemplate, status: 'archived' };
  const archivedChain: WorkflowChainResponseDto = { ...mockChain, status: 'archived' };

  const mockTenants: Tenant[] = [
    { id: 'tenant-a', name: 'Acme Corp', status: 'active', primaryContact: null, planTier: 'starter', dataResidency: 'us-east', maxMonthlyRuns: 100, assetRetentionDays: 30, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'tenant-b', name: 'Beta Inc', status: 'active', primaryContact: null, planTier: 'professional', dataResidency: 'us-east', maxMonthlyRuns: 500, assetRetentionDays: 90, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowSettingsModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS, multi: true,
          useValue: new LucideIconProvider({ Settings, X, Eye, Globe, Shield, Users, Archive, RefreshCw, AlertCircle, Loader2, Link, Send, Undo2 }),
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

  describe('archive confirmation flow', () => {
    it('[3.8-UNIT-016] [P0] Given non-archived template, when archive clicked, then shows confirmation', () => {
      createComponent({ type: 'template', data: mockTemplate });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-btn"]')).toBeTruthy();
      component.onArchiveClick();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-confirm"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-btn"]')).toBeFalsy();
    });

    it('[3.8-UNIT-016a] [P1] Given confirmation showing, when cancel clicked, then hides confirmation', () => {
      createComponent({ type: 'template', data: mockTemplate });
      component.onArchiveClick();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-confirm"]')).toBeTruthy();
      component.onArchiveCancel();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-confirm"]')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-btn"]')).toBeTruthy();
    });

    it('[3.8-UNIT-016b] [P1] Given confirmation showing, when confirm clicked via DOM, then sends archive request', () => {
      createComponent({ type: 'template', data: mockTemplate });
      component.onArchiveClick();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="settings-archive-confirm-btn"]') as HTMLButtonElement).click();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'archived' });
      req.flush({ ...mockTemplate, status: 'archived' });
    });
  });

  describe('archive template', () => {
    it('[3.8-UNIT-011] [P0] Given template, when archive confirmed, then sends PATCH with status archived', () => {
      createComponent({ type: 'template', data: mockTemplate });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onArchiveConfirm();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'archived' });
      req.flush({ ...mockTemplate, status: 'archived' });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-011a] [P1] Given template archive fails, when HTTP error, then shows error message', () => {
      createComponent({ type: 'template', data: mockTemplate });
      component.onArchiveConfirm();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(component.error()).toContain('not found');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('archive chain', () => {
    it('[3.8-UNIT-011b] [P0] Given chain, when archive confirmed, then sends DELETE', () => {
      createComponent({ type: 'chain', data: mockChain });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onArchiveConfirm();
      const req = httpMock.expectOne('/api/admin/workflow-chains/chain-1');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-011c] [P1] Given chain archive fails, when HTTP error, then shows error message', () => {
      createComponent({ type: 'chain', data: mockChain });
      component.onArchiveConfirm();
      const req = httpMock.expectOne('/api/admin/workflow-chains/chain-1');
      req.flush({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();
      expect(component.error()).toContain('unexpected error');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('unarchive template', () => {
    it('[3.8-UNIT-011d] [P0] Given archived template, when unarchive clicked, then sends PATCH with status draft', () => {
      createComponent({ type: 'template', data: archivedTemplate });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onUnarchive();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'draft' });
      req.flush({ ...mockTemplate, status: 'draft' });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-011e] [P1] Given template unarchive fails, when HTTP error, then shows error message', () => {
      createComponent({ type: 'template', data: archivedTemplate });
      component.onUnarchive();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      req.flush({ message: 'Bad Request' }, { status: 400, statusText: 'Bad Request' });
      fixture.detectChanges();
      expect(component.error()).toContain('Invalid data');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('unarchive chain', () => {
    it('[3.8-UNIT-011f] [P0] Given archived chain, when unarchive clicked, then sends PATCH restore', () => {
      createComponent({ type: 'chain', data: archivedChain });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onUnarchive();
      const req = httpMock.expectOne('/api/admin/workflow-chains/chain-1/restore');
      expect(req.request.method).toBe('PATCH');
      req.flush({ ...mockChain, status: 'draft' });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[3.8-UNIT-011g] [P1] Given chain unarchive fails, when HTTP error, then shows error message', () => {
      createComponent({ type: 'chain', data: archivedChain });
      component.onUnarchive();
      const req = httpMock.expectOne('/api/admin/workflow-chains/chain-1/restore');
      req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
      fixture.detectChanges();
      expect(component.error()).toContain('not found');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('publish template', () => {
    it('[4-FIX-A2-UNIT-009] [P0] Given draft template, when publish clicked, then sends PATCH with status published', () => {
      createComponent({ type: 'template', data: draftTemplate });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onPublish();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'published' });
      req.flush({ ...mockTemplate, status: 'published' });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[4-FIX-A2-UNIT-010] [P1] Given draft template, when rendered, then shows publish button', () => {
      createComponent({ type: 'template', data: draftTemplate });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-publish-btn"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-unpublish-btn"]')).toBeFalsy();
    });

    it('[4-FIX-A2-UNIT-011] [P1] Given chain, when rendered, then does not show publish button', () => {
      createComponent({ type: 'chain', data: mockChain });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-publish-btn"]')).toBeFalsy();
    });
  });

  describe('unpublish template', () => {
    it('[4-FIX-A2-UNIT-012] [P0] Given published template, when unpublish clicked, then sends PATCH with status draft', () => {
      createComponent({ type: 'template', data: mockTemplate });
      const savedSpy = jest.spyOn(component.saved, 'emit');
      component.onUnpublish();
      const req = httpMock.expectOne('/api/admin/workflow-templates/template-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'draft' });
      req.flush({ ...mockTemplate, status: 'draft' });
      expect(savedSpy).toHaveBeenCalled();
    });

    it('[4-FIX-A2-UNIT-013] [P1] Given published template, when rendered, then shows unpublish button', () => {
      createComponent({ type: 'template', data: mockTemplate });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-unpublish-btn"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-publish-btn"]')).toBeFalsy();
    });
  });

  describe('button visibility', () => {
    it('[3.8-UNIT-017] [P0] Given non-archived status, when rendered, then shows archive button', () => {
      createComponent({ type: 'template', data: mockTemplate });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-btn"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-unarchive-btn"]')).toBeFalsy();
    });

    it('[3.8-UNIT-017a] [P0] Given archived status, when rendered, then shows unarchive button', () => {
      createComponent({ type: 'template', data: archivedTemplate });
      expect(fixture.nativeElement.querySelector('[data-testid="settings-unarchive-btn"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="settings-archive-btn"]')).toBeFalsy();
    });
  });
});
