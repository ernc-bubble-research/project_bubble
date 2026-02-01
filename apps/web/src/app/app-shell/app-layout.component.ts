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
  selector: 'app-layout',
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  mobileMenuOpen = signal(false);

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
}
