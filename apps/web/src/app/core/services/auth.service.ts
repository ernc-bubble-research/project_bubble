import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import type { LoginResponseDto, User } from '@project-bubble/shared';

const TOKEN_KEY = 'bubble_access_token';

interface JwtPayload {
  sub: string;
  tenant_id: string;
  role: string;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<User | null>(null);

  constructor() {
    this.loadProfile();
  }

  login(email: string, password: string): Observable<LoginResponseDto> {
    return this.http
      .post<LoginResponseDto>('/api/auth/login', { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          this.loadProfile();
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = jwtDecode<JwtPayload>(token);
      return {
        id: payload.sub,
        email: '',
        role: payload.role as User['role'],
        tenantId: payload.tenant_id,
        createdAt: '',
        updatedAt: '',
      };
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = jwtDecode<JwtPayload>(token);
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getRoleHome(): string {
    const user = this.getCurrentUser();
    return user?.role === 'bubble_admin' ? '/admin/dashboard' : '/app/data-vault';
  }

  setPassword(token: string, password: string): Observable<void> {
    return this.http.post<void>('/api/auth/set-password', { token, password });
  }

  loadProfile(): void {
    if (!this.getToken()) return;
    this.http
      .get<User>('/api/auth/me')
      .pipe(catchError(() => of(null)))
      .subscribe((profile) => {
        this.user.set(profile);
      });
  }
}
