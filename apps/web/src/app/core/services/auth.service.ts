import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { LoginResponseDto } from '@project-bubble/shared';
import type { User } from '@project-bubble/shared';

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

  login(email: string, password: string): Observable<LoginResponseDto> {
    return this.http
      .post<LoginResponseDto>('/api/auth/login', { email, password })
      .pipe(tap((res) => localStorage.setItem(TOKEN_KEY, res.accessToken)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
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
}
