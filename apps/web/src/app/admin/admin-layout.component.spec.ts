import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout.component';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  LayoutDashboard,
  Building2,
  GitBranch,
  Settings,
} from 'lucide-angular';

describe('AdminLayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent, RouterModule.forRoot([])],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            LayoutDashboard,
            Building2,
            GitBranch,
            Settings,
          }),
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render 4 nav items', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const navItems = compiled.querySelectorAll('.nav-item');
    expect(navItems.length).toBe(4);
  });

  it('should render sidebar with correct nav labels', () => {
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
      'System Settings',
    ]);
  });

  it('should contain a router-outlet', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should toggle mobile menu', () => {
    const fixture = TestBed.createComponent(AdminLayoutComponent);
    const component = fixture.componentInstance;
    expect(component.mobileMenuOpen()).toBe(false);
    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBe(true);
    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBe(false);
  });
});
