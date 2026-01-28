import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantAuthGuard } from './tenant-auth.guard';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        JwtModule.register({
            secret: process.env['JWT_SECRET'] || 'dev_secret_key_change_in_prod',
            signOptions: { expiresIn: '1d' },
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    host: configService.get('REDIS_HOST') || 'localhost',
                    port: Number(configService.get('REDIS_PORT')) || 6379,
                },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [PrismaService, TenantAuthGuard],
    exports: [PrismaService, TenantAuthGuard, JwtModule, BullModule],
})
export class BackendCoreModule { }
