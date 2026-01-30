import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  standalone: true,
  imports: [RouterModule, NgClass, LucideAngularModule],
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  mobileMenuOpen = signal(false);

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'layout-dashboard', route: '/admin/dashboard' },
    { label: 'Tenants', icon: 'building-2', route: '/admin/tenants' },
    { label: 'Workflow Studio', icon: 'git-branch', route: '/admin/workflows' },
    { label: 'System Settings', icon: 'settings', route: '/admin/settings' },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
