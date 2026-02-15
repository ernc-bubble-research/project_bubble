import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, RouterModule } from '@angular/router';
import { AppLayoutComponent } from './app-layout.component';
import { AuthService } from '../core/services/auth.service';
import type { User } from '@project-bubble/shared';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Database,
  GitBranch,
  Menu,
  LogOut,
  ChevronDown,
  Settings,
  Shield,
} from 'lucide-angular';

@Component({ standalone: true, template: '' })
class DummyComponent {}

const mockUser: User = {
  id: '2',
  email: 'creator@test.com',
  role: 'creator',
  name: 'Test Creator',
  tenantId: 't1',
  createdAt: '',
  updatedAt: '',
};

describe('AppLayoutComponent [P2]', () => {
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
        AppLayoutComponent,
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
            Database,
            GitBranch,
            Menu,
            LogOut,
            ChevronDown,
            Settings,
            Shield,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-2-UNIT-022] should create', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[3.1-2-UNIT-023] should render 3 nav items', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navItems = compiled.querySelectorAll('.nav-item');
    expect(navItems.length).toBe(3);
  });

  it('[3.1-2-UNIT-024] should render avatar dropdown when user is loaded', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="avatar-dropdown"]')).toBeTruthy();
  });

  it('[3.1-2-UNIT-025] should call authService.logout and navigate on logout', () => {
    const fixture = TestBed.createComponent(AppLayoutComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const component = fixture.componentInstance;
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
