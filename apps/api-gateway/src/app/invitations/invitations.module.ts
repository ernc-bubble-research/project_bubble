import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationEntity, TenantEntity, UserEntity } from '@project-bubble/db-layer';
import { EmailModule } from '../email/email.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { AdminInvitationsController } from './admin-invitations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvitationEntity, UserEntity, TenantEntity]),
    EmailModule,
  ],
  controllers: [InvitationsController, AdminInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
