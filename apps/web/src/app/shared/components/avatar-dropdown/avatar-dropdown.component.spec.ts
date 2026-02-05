import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  ChevronDown,
  Settings,
  LogOut,
} from 'lucide-angular';
import type { User } from '@project-bubble/shared';
import { AvatarDropdownComponent } from './avatar-dropdown.component';

@Component({ standalone: true, template: '' })
class DummyComponent {}

@Component({
  standalone: true,
  imports: [AvatarDropdownComponent],
  template: `<app-avatar-dropdown
    [user]="testUser"
    [showSettingsLink]="showSettings"
    (logoutClicked)="onLogout()"
  />`,
})
class TestHostComponent {
  testUser: User = {
    id: '1',
    email: 'jane@test.com',
    role: 'bubble_admin',
    tenantId: 't1',
    createdAt: '',
    updatedAt: '',
  };
  showSettings = false;
  onLogout = jest.fn();
}

describe('AvatarDropdownComponent [P2]', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        RouterModule.forRoot([
          { path: 'admin/settings', component: DummyComponent },
        ]),
      ],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ ChevronDown, Settings, LogOut }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    // NOTE: detectChanges NOT called here — tests configure host properties first
  });

  it('[3.1-2-UNIT-010] should show initials from name', () => {
    // Given — user has a name
    host.testUser = { ...host.testUser, name: 'Jane Doe' };
    fixture.detectChanges();

    // Then
    const initials = el.querySelector('[data-testid="avatar-initials"]');
    expect(initials?.textContent?.trim()).toBe('JD');
  });

  it('[3.1-2-UNIT-011] should show initial from email when no name', () => {
    // Given — user has no name, email is "jane@test.com"
    fixture.detectChanges();

    // Then
    const initials = el.querySelector('[data-testid="avatar-initials"]');
    expect(initials?.textContent?.trim()).toBe('J');
  });

  it('[3.1-2-UNIT-012] should open dropdown on trigger click', () => {
    // Given — dropdown is closed
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeNull();

    // When — click trigger
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeTruthy();
  });

  it('[3.1-2-UNIT-013] should close dropdown on click outside', () => {
    // Given — dropdown is open
    fixture.detectChanges();
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeTruthy();

    // When — click outside the component
    document.body.click();
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeNull();
  });

  it('[3.1-2-UNIT-014] should close dropdown on Escape key', () => {
    // Given — dropdown is open
    fixture.detectChanges();
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeTruthy();

    // When — press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeNull();
  });

  it('[3.1-2-UNIT-015] should emit logoutClicked when logout button clicked', () => {
    // Given — dropdown is open
    fixture.detectChanges();
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // When — click logout
    const logoutBtn = el.querySelector('[data-testid="dropdown-logout-btn"]') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();

    // Then
    expect(host.onLogout).toHaveBeenCalled();
  });

  it('[3.1-2-UNIT-016] should show settings link when showSettingsLink is true', () => {
    // Given — settings link enabled before first render
    host.showSettings = true;
    fixture.detectChanges();

    // When — open dropdown
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="settings-link"]')).toBeTruthy();
  });

  it('[3.1-2-UNIT-017] should not show settings link when showSettingsLink is false', () => {
    // Given — showSettings is false (default)
    fixture.detectChanges();

    // When — open dropdown
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="settings-link"]')).toBeNull();
  });

  it('[3.1-2-UNIT-018] should show "Bubble Admin" badge for bubble_admin role', () => {
    // Given — user is bubble_admin (default)
    fixture.detectChanges();

    // When — open dropdown
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // Then
    const badge = el.querySelector('.dropdown-role-badge');
    expect(badge?.textContent?.trim()).toBe('Bubble Admin');
  });

  it('[3.1-2-UNIT-019] should show "Creator" badge for creator role', () => {
    // Given — user is a creator (set before first render)
    host.testUser = { ...host.testUser, role: 'creator' };
    fixture.detectChanges();

    // When — open dropdown
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // Then
    const badge = el.querySelector('.dropdown-role-badge');
    expect(badge?.textContent?.trim()).toBe('Creator');
  });

  it('[3.1-2-UNIT-026] should have aria-label and title on trigger button', () => {
    // Given — user has a name
    host.testUser = { ...host.testUser, name: 'Jane Doe' };
    fixture.detectChanges();

    // Then
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('User menu for Jane Doe');
    expect(trigger.getAttribute('title')).toBe('Jane Doe');
  });

  it('[3.1-2-UNIT-027] should return focus to trigger on Escape', () => {
    // Given — dropdown is open
    fixture.detectChanges();
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    // When — press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    // Then — focus should be on the trigger
    expect(document.activeElement).toBe(trigger);
  });

  it('[3.1-2-UNIT-028] should close dropdown when settings link is clicked', () => {
    // Given — dropdown is open with settings link visible
    host.showSettings = true;
    fixture.detectChanges();
    const trigger = el.querySelector('[data-testid="avatar-trigger"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeTruthy();

    // When — click settings link
    const settingsLink = el.querySelector('[data-testid="settings-link"]') as HTMLAnchorElement;
    settingsLink.click();
    fixture.detectChanges();

    // Then
    expect(el.querySelector('[data-testid="avatar-menu"]')).toBeNull();
  });
});
