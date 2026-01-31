import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Path 1: Valid JWT with bubble_admin role (set by OptionalJwtAuthGuard)
    if (request.user?.role === 'bubble_admin') {
      return true;
    }

    // Path 2: Valid admin API key header (backward compatibility)
    const apiKey = request.headers['x-admin-api-key'];
    const expectedKey = this.config.get<string>('ADMIN_API_KEY');

    if (apiKey && expectedKey && apiKey.length === expectedKey.length) {
      const isMatch = timingSafeEqual(
        Buffer.from(apiKey),
        Buffer.from(expectedKey),
      );
      if (isMatch) {
        // Set synthetic admin user so downstream RolesGuard sees bubble_admin role
        request.user = { userId: 'api-key', tenantId: null, role: 'bubble_admin' };
        return true;
      }
    }

    throw new UnauthorizedException(
      'Invalid or missing admin API key or JWT token',
    );
  }
}
