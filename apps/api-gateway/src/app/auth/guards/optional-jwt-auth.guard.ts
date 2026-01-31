import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    _err: unknown,
    user: TUser | false,
  ): TUser | null {
    // Don't throw on missing/invalid token — let downstream guards handle auth
    return user || null;
  }
}
