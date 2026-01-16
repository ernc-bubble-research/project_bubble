import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantAuthGuard } from './tenant-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot(),
        JwtModule.register({
            secret: process.env['JWT_SECRET'] || 'dev_secret_key_change_in_prod',
            signOptions: { expiresIn: '1d' },
        }),
    ],
    providers: [PrismaService, TenantAuthGuard],
    exports: [PrismaService, TenantAuthGuard, JwtModule],
})
export class BackendCoreModule { }
