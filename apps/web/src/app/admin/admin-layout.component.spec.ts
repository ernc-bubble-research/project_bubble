import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '../core/services/auth.service';
import type { User } from '@project-bubble/shared';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutDashboard,
  Building2,
  GitBranch,
  Settings,
  Menu,
  LogOut,
  ChevronDown,
} from 'lucide-angular';

@Component({ standalone: true, template: '' })
class DummyComponent {}

const mockUser: User = {
  id: '1',
  email: 'admin@test.com',
  role: 'bubble_admin',
  name: 'Test Admin',
  tenantId: 't1',
  createdAt: '',
  updatedAt: '',
};

describe('AdminLayoutComponent [P2]', () => {
  const userSignal = signal<User | null>(mockUser);
  const mockAuthService = {
    user: userSignal,
    getCurrentUser: jest.fn().mockReturnValue(mockUser),
    logout: jest.fn(),
    loadProfile: jest.fn(),
  };

  beforeEach(async () => {
    userSignal.set(mockUser);
    mockAuthService.logout.mockClear();
    mockAuthService.getCurrentUser.mockReturnValue(mockUser);

    await TestBed.configureTestingModule({
      imports: [
        AdminLayoutComponent,
        RouterModule.forRoot([
          { path: 'auth/login', component: DummyComponent },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            LayoutDashboard,
            Building2,
            GitBranch,
            Settings,
            Menu,
            LogOut,
            ChevronDown,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[1H.1-UNIT-001] should create', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should render 4 nav items', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navItems = compiled.querySelectorAll('.nav-item');
    expect(navItems.length).toBe(4);
  });

  it('[1H.1-UNIT-003] should render sidebar with correct nav labels', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const labels = Array.from(
      compiled.querySelectorAll('.nav-label')
    ).map((el) => el.textContent?.trim());
    expect(labels).toEqual([
      'Dashboard',
      'Tenants',
      'Workflow Studio',
      'Settings',
    ]);
  });

  it('[1H.1-UNIT-004] should contain a router-outlet', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('[1H.1-UNIT-005] should toggle mobile menu', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    const component = fixture.componentInstance;
    expect(component.mobileMenuOpen()).toBe(false);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);
    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });

  it('[1H.1-UNIT-006] should render avatar dropdown when user is loaded', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="avatar-dropdown"]')).toBeTruthy();
  });

  it('[1H.1-UNIT-007] should call authService.logout and navigate on logout', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const component = fixture.componentInstance;
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('[3.1-2-UNIT-020] should not render avatar dropdown when user is null', () => {
    userSignal.set(null);
    mockAuthService.getCurrentUser.mockReturnValue(null);
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="avatar-dropdown"]')).toBeNull();
  });
});
