import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Building2,
} from 'lucide-angular';
import { TenantListComponent } from './tenant-list.component';
import { TenantService } from '../../core/services/tenant.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('TenantListComponent [P2]', () => {
  let component: TenantListComponent;
  let fixture: ComponentFixture<TenantListComponent>;
  let router: Router;

  const mockTenants = [
    {
      id: 'id-1',
      name: 'Acme Corp',
      status: 'active' as const,
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    },
    {
      id: 'id-2',
      name: 'Beta Inc',
      status: 'suspended' as const,
      createdAt: '2026-01-14T00:00:00Z',
      updatedAt: '2026-01-14T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    const tenantServiceMock = {
      getAll: jest.fn().mockReturnValue(of(mockTenants)),
    };

    await TestBed.configureTestingModule({
      imports: [TenantListComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: tenantServiceMock },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Building2 }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('[1H.1-UNIT-001] should create', () => {
    expect(component).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should load tenants on init', () => {
    expect(component.tenants().length).toBe(2);
  });

  it('[1H.1-UNIT-003] should render tenant table with rows', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.tenant-row');
    expect(rows.length).toBe(2);
  });

  it('[1H.1-UNIT-004] should render filter tabs with correct counts', () => {
    expect(component.allCount()).toBe(2);
    expect(component.activeCount()).toBe(1);
    expect(component.suspendedCount()).toBe(1);
  });

  it('[1H.1-UNIT-005] should filter tenants by status', () => {
    component.setFilter('active');
    expect(component.filteredTenants().length).toBe(1);
    expect(component.filteredTenants()[0].name).toBe('Acme Corp');

    component.setFilter('suspended');
    expect(component.filteredTenants().length).toBe(1);
    expect(component.filteredTenants()[0].name).toBe('Beta Inc');

    component.setFilter('all');
    expect(component.filteredTenants().length).toBe(2);
  });

  it('[1H.1-UNIT-006] should navigate to tenant detail on row click', () => {
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.navigateToTenant(mockTenants[0]);
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/tenants', 'id-1']);
  });
});
