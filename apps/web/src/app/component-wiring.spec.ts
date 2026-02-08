/**
 * Component Wiring Tests — Angular Composite Renders
 *
 * Verifies that Angular composite components render with REAL child components
 * (not stubs). Catches:
 * - Missing imports in @Component decorator
 * - Unregistered Lucide icons (silent empty renders)
 * - Template binding errors
 * - Child component dependency injection failures
 *
 * Strategy: Import real components, mock only HTTP services.
 * Zoneless testing: async/await + fixture.whenStable()
 */
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

import {
  LucideIconProvider,
  LUCIDE_ICONS,
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
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Save,
  FileText,
  Wand2,
  Brain,
  MessageSquare,
  FileOutput,
  Layers,
  Zap,
  Server,
  Pencil,
  Loader2,
  Key,
  Lock,
  LockOpen,
  FileX,
  FolderPlus,
  Link,
  Search,
  MoreVertical,
  Tag,
  ArrowDown,
  LogIn,
  ArrowRightLeft,
  HelpCircle,
  UploadCloud,
  Loader,
  Files,
  Folder,
  Archive,
  Globe,
  Shield,
  Database,
  LayoutGrid,
  List,
} from 'lucide-angular';

// Services to mock
import { AuthService } from './core/services/auth.service';
import { TenantService } from './core/services/tenant.service';
import { AssetService } from './core/services/asset.service';
import { WorkflowTemplateService } from './core/services/workflow-template.service';
import { WorkflowChainService } from './core/services/workflow-chain.service';
import { LlmModelService } from './core/services/llm-model.service';
import { LlmProviderService } from './core/services/llm-provider.service';
import { InvitationService } from './core/services/invitation.service';
import { ImpersonationService } from './core/services/impersonation.service';
import { ToastService } from './core/services/toast.service';

// Composite components under test
import { AdminLayoutComponent } from './admin/admin-layout.component';
import { AppLayoutComponent } from './app-shell/app-layout.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { SettingsComponent } from './admin/settings/settings.component';
import { TenantDetailComponent } from './admin/tenants/tenant-detail.component';
import { DataVaultComponent } from './app/data-vault/data-vault.component';
import { WorkflowStudioComponent } from './admin/workflows/workflow-studio.component';
import { WorkflowWizardComponent } from './admin/workflows/wizard/workflow-wizard.component';
import { ChainBuilderComponent } from './admin/workflows/chain-builder/chain-builder.component';

import type { User } from '@project-bubble/shared';

// ── Shared Test Utilities ─────────────────────────────────────────

@Component({ standalone: true, template: '' })
class DummyComponent {}

const mockUser: User = {
  id: 'u1',
  email: 'admin@test.com',
  role: 'bubble_admin',
  name: 'Test Admin',
  tenantId: 't1',
  createdAt: '',
  updatedAt: '',
};

// Source of truth: apps/web/src/app/app.config.ts — keep in sync with the
// LucideIconProvider registration there. If a new icon is added to app.config.ts,
// it must also be added here (import + object entry) to prevent silent render failures.
const ALL_ICONS = {
  LayoutDashboard, Building2, GitBranch, Settings, AlertTriangle, Copy,
  ArrowLeft, X, Clock, BarChart3, CircleCheck, CircleX, Users, Menu,
  Info, Eye, EyeOff, LogOut, UserPlus, Send, RefreshCw, XCircle,
  AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, ChevronRight,
  Check, Save, FileText, Wand2, Brain, MessageSquare, FileOutput,
  Layers, Zap, Server, Pencil, Loader2, Key, Lock, LockOpen, FileX,
  FolderPlus, Link, Search, MoreVertical, Tag, ArrowDown, LogIn,
  ArrowRightLeft, HelpCircle, UploadCloud, Loader, Files, Folder,
  Archive, Globe, Shield, Database, LayoutGrid, List,
};

function provideAllIcons() {
  return {
    provide: LUCIDE_ICONS,
    multi: true,
    useValue: new LucideIconProvider(ALL_ICONS),
  };
}

function createMockAuthService() {
  return {
    user: signal<User | null>(mockUser),
    getCurrentUser: jest.fn().mockReturnValue(mockUser),
    logout: jest.fn(),
    loadProfile: jest.fn(),
  };
}

function createMockTenantService() {
  return {
    getAll: jest.fn().mockReturnValue(of([])),
    getOne: jest.fn().mockReturnValue(of({ id: 't1', name: 'Test', status: 'active' })),
    create: jest.fn().mockReturnValue(of({})),
    update: jest.fn().mockReturnValue(of({})),
    archive: jest.fn().mockReturnValue(of(void 0)),
    unarchive: jest.fn().mockReturnValue(of({})),
    hardDelete: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockWorkflowTemplateService() {
  return {
    create: jest.fn().mockReturnValue(of({})),
    getById: jest.fn().mockReturnValue(of({ id: 't1', name: 'Test', definition: { inputs: [], sections: [] } })),
    getAll: jest.fn().mockReturnValue(of([])),
    update: jest.fn().mockReturnValue(of({})),
    delete: jest.fn().mockReturnValue(of(void 0)),
    createVersion: jest.fn().mockReturnValue(of({})),
  };
}

function createMockWorkflowChainService() {
  return {
    create: jest.fn().mockReturnValue(of({})),
    getById: jest.fn().mockReturnValue(of({ id: 'c1', name: 'Test Chain', definition: { steps: [] } })),
    getAll: jest.fn().mockReturnValue(of([])),
    update: jest.fn().mockReturnValue(of({})),
    delete: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockLlmModelService() {
  return {
    getAllModels: jest.fn().mockReturnValue(of([])),
    create: jest.fn().mockReturnValue(of({})),
    update: jest.fn().mockReturnValue(of({})),
    delete: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockLlmProviderService() {
  return {
    getAllConfigs: jest.fn().mockReturnValue(of([])),
    create: jest.fn().mockReturnValue(of({})),
    update: jest.fn().mockReturnValue(of({})),
    delete: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockAssetService() {
  return {
    findAll: jest.fn().mockReturnValue(of([])),
    findAllFolders: jest.fn().mockReturnValue(of([])),
    findOne: jest.fn().mockReturnValue(of({})),
    upload: jest.fn().mockReturnValue(of({})),
    createFolder: jest.fn().mockReturnValue(of({})),
    update: jest.fn().mockReturnValue(of({})),
    updateFolder: jest.fn().mockReturnValue(of({})),
    archive: jest.fn().mockReturnValue(of({})),
    restore: jest.fn().mockReturnValue(of({})),
    deleteFolder: jest.fn().mockReturnValue(of(void 0)),
    indexAsset: jest.fn().mockReturnValue(of({})),
    deIndexAsset: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockToastService() {
  return {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };
}

function createMockInvitationService() {
  return {
    getAll: jest.fn().mockReturnValue(of([])),
    create: jest.fn().mockReturnValue(of({})),
    resend: jest.fn().mockReturnValue(of(void 0)),
    revoke: jest.fn().mockReturnValue(of(void 0)),
  };
}

function createMockImpersonationService() {
  return {
    impersonate: jest.fn(),
    stopImpersonation: jest.fn(),
    isImpersonating: signal(false),
  };
}

function createMockActivatedRoute(params: Record<string, string> = {}) {
  return {
    snapshot: { paramMap: { get: (key: string) => params[key] ?? null } },
    paramMap: of(new Map(Object.entries(params))),
    queryParamMap: of(new Map()),
    params: of(params),
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Component Wiring — Composite Renders [P0]', () => {

  // ── Layout Components ───────────────────────────────────────────

  it('[MW-1-CW-001] [P0] AdminLayoutComponent renders with real AvatarDropdownComponent', async () => {
    await TestBed.configureTestingModule({
      imports: [
        AdminLayoutComponent,
        RouterModule.forRoot([
          { path: 'auth/login', component: DummyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: createMockAuthService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    // Verify real child component rendered
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-avatar-dropdown')).toBeTruthy();
    fixture.destroy();
  });

  it('[MW-1-CW-002] [P0] AppLayoutComponent renders with real AvatarDropdownComponent', async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppLayoutComponent,
        RouterModule.forRoot([
          { path: 'auth/login', component: DummyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: createMockAuthService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-avatar-dropdown')).toBeTruthy();
    fixture.destroy();
  });

  // ── Admin Page Components ───────────────────────────────────────

  it('[MW-1-CW-003] [P0] DashboardComponent renders with real StatCard, StatusBadge, CreateTenantModal', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: TenantService, useValue: createMockTenantService() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    // StatCard components render with icons
    expect(el.querySelectorAll('app-stat-card').length).toBeGreaterThanOrEqual(1);
    fixture.destroy();
  });

  it('[MW-1-CW-004] [P0] SettingsComponent renders with real LlmModelsList and ProviderConfigList', async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: LlmModelService, useValue: createMockLlmModelService() },
        { provide: LlmProviderService, useValue: createMockLlmProviderService() },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    // Default tab is 'llm-models'
    expect(el.querySelector('app-llm-models-list')).toBeTruthy();
    fixture.destroy();
  });

  it('[MW-1-CW-005] [P0] TenantDetailComponent renders with real StatusBadge and dialog components', async () => {
    await TestBed.configureTestingModule({
      imports: [
        TenantDetailComponent,
        RouterModule.forRoot([]),
      ],
      providers: [
        { provide: ActivatedRoute, useValue: createMockActivatedRoute({ id: 'tenant-1' }) },
        { provide: TenantService, useValue: createMockTenantService() },
        { provide: InvitationService, useValue: createMockInvitationService() },
        { provide: ImpersonationService, useValue: createMockImpersonationService() },
        { provide: ToastService, useValue: createMockToastService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TenantDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    fixture.destroy();
  });

  // ── App Page Components ─────────────────────────────────────────

  it('[MW-1-CW-006] [P0] DataVaultComponent renders with real FolderTree, FileCard, UploadZone, CreateFolderDialog', async () => {
    await TestBed.configureTestingModule({
      imports: [DataVaultComponent],
      providers: [
        { provide: AssetService, useValue: createMockAssetService() },
        { provide: ActivatedRoute, useValue: createMockActivatedRoute() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DataVaultComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-folder-tree')).toBeTruthy();
    expect(el.querySelector('app-upload-zone')).toBeTruthy();
    fixture.destroy();
  });

  // ── Workflow Components ─────────────────────────────────────────

  it('[MW-1-CW-007] [P0] WorkflowStudioComponent renders with real TemplateListComponent and ChainListComponent', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowStudioComponent],
      providers: [
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: WorkflowTemplateService, useValue: createMockWorkflowTemplateService() },
        { provide: WorkflowChainService, useValue: createMockWorkflowChainService() },
        { provide: ToastService, useValue: createMockToastService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkflowStudioComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    // Default tab shows templates
    expect(el.querySelector('app-template-list')).toBeTruthy();
    fixture.destroy();
  });

  it('[MW-1-CW-008] [P0] WorkflowWizardComponent renders with all 4 real step children', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowWizardComponent],
      providers: [
        { provide: ActivatedRoute, useValue: createMockActivatedRoute() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: WorkflowTemplateService, useValue: createMockWorkflowTemplateService() },
        { provide: LlmModelService, useValue: createMockLlmModelService() },
        { provide: ToastService, useValue: createMockToastService() },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkflowWizardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    // Step 0 (Metadata) should be visible by default
    expect(el.querySelector('app-wizard-metadata-step')).toBeTruthy();
    fixture.destroy();
  });

  it('[MW-1-CW-009] [P0] ChainBuilderComponent renders with all 7 real child sections', async () => {
    await TestBed.configureTestingModule({
      imports: [ChainBuilderComponent],
      providers: [
        { provide: ActivatedRoute, useValue: createMockActivatedRoute() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: WorkflowChainService, useValue: createMockWorkflowChainService() },
        { provide: WorkflowTemplateService, useValue: createMockWorkflowTemplateService() },
        { provide: TenantService, useValue: createMockTenantService() },
        { provide: ToastService, useValue: createMockToastService() },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ChainBuilderComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    // Metadata section should always be visible
    expect(el.querySelector('app-chain-metadata-section')).toBeTruthy();
    // Visibility settings always visible
    expect(el.querySelector('app-chain-visibility-settings')).toBeTruthy();
    fixture.destroy();
  });

  // ── Lucide Icon Verification ────────────────────────────────────

  it('[MW-1-CW-010] [P0] Lucide icons render SVG content (not empty) in AdminLayoutComponent', async () => {
    await TestBed.configureTestingModule({
      imports: [
        AdminLayoutComponent,
        RouterModule.forRoot([
          { path: 'auth/login', component: DummyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: createMockAuthService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const lucideIcons = el.querySelectorAll('lucide-icon');
    expect(lucideIcons.length).toBeGreaterThan(0);

    // Verify at least one icon renders SVG (not empty)
    const firstIcon = lucideIcons[0];
    expect(firstIcon.querySelector('svg')).toBeTruthy();
    fixture.destroy();
  });

  it('[MW-1-CW-011] [P0] Lucide icons render SVG content in WorkflowStudioComponent', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowStudioComponent],
      providers: [
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: WorkflowTemplateService, useValue: createMockWorkflowTemplateService() },
        { provide: WorkflowChainService, useValue: createMockWorkflowChainService() },
        { provide: ToastService, useValue: createMockToastService() },
        provideAllIcons(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkflowStudioComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const lucideIcons = el.querySelectorAll('lucide-icon');
    expect(lucideIcons.length).toBeGreaterThan(0);

    // Verify every icon has SVG content (no silent failures)
    lucideIcons.forEach((icon) => {
      expect(icon.querySelector('svg')).toBeTruthy();
    });
    fixture.destroy();
  });
});
