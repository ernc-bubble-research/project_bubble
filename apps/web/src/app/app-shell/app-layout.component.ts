import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/services/auth.service';
import { AvatarDropdownComponent } from '../shared/components/avatar-dropdown/avatar-dropdown.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  standalone: true,
  imports: [RouterModule, NgClass, LucideAngularModule, AvatarDropdownComponent],
  selector: 'app-layout',
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  mobileMenuOpen = signal(false);

  readonly user = computed(() => this.authService.user() ?? this.authService.getCurrentUser());

  navItems: NavItem[] = [
    { label: 'Data Vault', icon: 'database', route: '/app/data-vault' },
    { label: 'Workflows', icon: 'git-branch', route: '/app/workflows' },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
