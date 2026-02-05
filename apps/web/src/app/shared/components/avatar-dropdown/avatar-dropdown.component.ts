import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import type { User } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [RouterModule, LucideAngularModule],
  selector: 'app-avatar-dropdown',
  templateUrl: './avatar-dropdown.component.html',
  styleUrl: './avatar-dropdown.component.scss',
})
export class AvatarDropdownComponent {
  user = input.required<User>();
  showSettingsLink = input(false);
  logoutClicked = output<void>();

  dropdownOpen = signal(false);

  private readonly elRef = inject(ElementRef);

  initials = computed(() => {
    const u = this.user();
    if (u.name) {
      return u.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (u.email) {
      return u.email[0].toUpperCase();
    }
    return '?';
  });

  displayName = computed(() => {
    const u = this.user();
    return u.name || u.email || 'User';
  });

  roleBadge = computed(() => {
    const u = this.user();
    switch (u.role) {
      case 'bubble_admin':
        return 'Bubble Admin';
      case 'customer_admin':
        return 'Admin';
      case 'creator':
        return 'Creator';
      default:
        return u.role;
    }
  });

  toggleDropdown(): void {
    const wasOpen = this.dropdownOpen();
    this.dropdownOpen.update((v) => !v);
    if (wasOpen) {
      this.focusTrigger();
    }
  }

  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  onLogout(): void {
    this.dropdownOpen.set(false);
    this.logoutClicked.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen()) return;
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.dropdownOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.dropdownOpen()) return;
    this.dropdownOpen.set(false);
    this.focusTrigger();
  }

  private focusTrigger(): void {
    const trigger = this.elRef.nativeElement.querySelector('[data-testid="avatar-trigger"]') as HTMLElement | null;
    trigger?.focus();
  }
}
