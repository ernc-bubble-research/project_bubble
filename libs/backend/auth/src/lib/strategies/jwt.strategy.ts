import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET', 'secretKey'),
        });
    }

    async validate(payload: any) {
        // This payload is the decoded JWT.
        // We return what we want mapped to `req.user`
        if (!payload.sub || !payload.tenantId) {
            throw new UnauthorizedException();
        }
        return { userId: payload.sub, email: payload.email, tenantId: payload.tenantId, role: payload.role };
    }
}
