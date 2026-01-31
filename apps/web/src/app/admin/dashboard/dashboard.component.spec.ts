import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  BarChart3,
  CircleCheck,
  CircleX,
  Users,
} from 'lucide-angular';
import { DashboardComponent } from './dashboard.component';
import { Tenant } from '../../core/services/tenant.service';

const mockTenants: Tenant[] = [
  {
    id: '1',
    name: 'Acme Corp',
    status: 'active',
    createdAt: '2026-01-30T00:00:00Z',
    updatedAt: '2026-01-30T00:00:00Z',
  },
  {
    id: '2',
    name: 'Beta Inc',
    status: 'suspended',
    createdAt: '2026-01-29T00:00:00Z',
    updatedAt: '2026-01-29T00:00:00Z',
  },
];

describe('DashboardComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            BarChart3,
            CircleCheck,
            CircleX,
            Users,
          }),
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render stat cards', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const statCards = compiled.querySelectorAll('app-stat-card');
    expect(statCards.length).toBe(4);
  });

  it('should render tenant table with data', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('should show empty state when no tenants', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tenants yet');
  });

  it('should filter tenants by status', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.setFilter('active');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Acme Corp');
  });

  it('should compute stat card values correctly', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.totalTenants()).toBe(2);
    expect(component.activeTenants()).toBe(1);
    expect(component.suspendedTenants()).toBe(1);
  });

  it('should open create modal when button clicked', async () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/admin/tenants').flush(mockTenants);
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.showCreateModal()).toBe(false);
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
  });
});
