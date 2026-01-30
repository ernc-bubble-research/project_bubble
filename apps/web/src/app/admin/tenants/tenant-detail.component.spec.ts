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
} from 'lucide-angular';
import { TenantDetailComponent } from './tenant-detail.component';
import { TenantService } from '../../core/services/tenant.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('TenantDetailComponent', () => {
  let component: TenantDetailComponent;
  let fixture: ComponentFixture<TenantDetailComponent>;

  const mockTenant = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Corp',
    status: 'active' as const,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  beforeEach(async () => {
    const tenantServiceMock = {
      getOne: jest.fn().mockReturnValue(of(mockTenant)),
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
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load tenant on init', () => {
    expect(component.tenant()).toEqual(mockTenant);
  });

  it('should render breadcrumb with tenant name', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.breadcrumb-current')?.textContent).toContain(
      'Acme Corp'
    );
  });

  it('should render header card with tenant name and status', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.tenant-name')?.textContent).toContain(
      'Acme Corp'
    );
    expect(el.querySelector('app-status-badge')).toBeTruthy();
  });

  it('should render Impersonate button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const impersonateBtn = el.querySelector('.btn-danger-outline');
    expect(impersonateBtn).toBeTruthy();
    expect(impersonateBtn?.textContent).toContain('Impersonate');
  });

  it('should render tab navigation with 5 tabs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const tabs = el.querySelectorAll('.tab-btn');
    expect(tabs.length).toBe(5);
    expect(tabs[0].textContent?.trim()).toBe('General');
  });

  it('should show General tab content by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.form-card')).toBeTruthy();
  });

  it('should open impersonate dialog when button clicked', () => {
    expect(component.showImpersonateDialog()).toBe(false);
    component.openImpersonateDialog();
    expect(component.showImpersonateDialog()).toBe(true);
  });
});
