import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class TenantAuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            throw new UnauthorizedException('No token provided');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env['JWT_SECRET'] || 'dev_secret_key_change_in_prod',
            });

            // 💡 Attach tenant context to the request for Controllers to use
            // In a real RLS setup, this would also trigger the DB session switch
            request['user'] = payload;
            request['tenantId'] = payload.tenantId;

            return true;
        } catch {
            throw new UnauthorizedException();
        }
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        // Check Authorization Header
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}
