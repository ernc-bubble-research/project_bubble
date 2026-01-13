import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EntityManager } from 'typeorm';
import { TenancyInterceptor, TransactionManager } from '@project_bubble/backend/infra';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @UseInterceptors(TenancyInterceptor)
    async login(
        @Body('email') email: string,
        @TransactionManager() manager: EntityManager
    ) {
        return this.authService.login(email, manager);
    }
}
