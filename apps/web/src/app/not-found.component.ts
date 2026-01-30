import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'app-not-found',
  template: `
    <div class="not-found">
      <h1>404</h1>
      <p>Page not found</p>
      <a routerLink="/admin/dashboard">Go to Dashboard</a>
    </div>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        gap: 8px;
      }
      h1 {
        font-size: 64px;
        color: var(--slate-300);
      }
      p {
        font-size: 18px;
        color: var(--text-secondary);
      }
      a {
        margin-top: 16px;
        color: var(--primary-600);
        font-weight: 600;
      }
    `,
  ],
})
export class NotFoundComponent {}
