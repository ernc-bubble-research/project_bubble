import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="coming-soon-container">
      <div class="coming-soon-card">
        <img src="bubble_logo.png" alt="Bubble" class="logo" />
        <h1>Coming Soon</h1>
        <p>The Bubble workspace is under construction.</p>
        <button class="btn btn-outline" (click)="logout()">
          <lucide-icon name="log-out" [size]="16"></lucide-icon>
          Logout
        </button>
      </div>
    </div>
  `,
  styles: [`
    .coming-soon-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--bg-app);
      padding: 24px;
    }

    .coming-soon-card {
      text-align: center;
      background: var(--bg-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      padding: 48px 40px;
      max-width: 420px;
    }

    .logo {
      height: 48px;
      width: auto;
      margin-bottom: 24px;
    }

    h1 {
      font-size: 24px;
      color: var(--text-main);
      margin-bottom: 8px;
    }

    p {
      color: var(--text-secondary);
      font-size: 15px;
      margin-bottom: 32px;
    }
  `],
})
export class ComingSoonComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/auth/login');
  }
}
