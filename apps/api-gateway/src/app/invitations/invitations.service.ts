import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  InvitationEntity,
  InvitationStatus,
  TenantEntity,
  UserEntity,
  UserRole,
  UserStatus,
} from '@project-bubble/db-layer';
import {
  InviteUserDto,
  AcceptInvitationDto,
  InvitationResponseDto,
} from '@project-bubble/shared';
import { EmailService } from '../email/email.service';

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    @InjectRepository(InvitationEntity)
    private readonly invitationRepo: Repository<InvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: InviteUserDto,
    tenantId: string,
    inviterId: string,
    inviterName: string,
  ): Promise<InvitationResponseDto> {
    // Look up tenant name for email (outside transaction — read-only, no race risk)
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const tenantName = tenant?.name || 'your organization';

    // Generate secure token with prefix for efficient lookup
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const tokenPrefix = rawToken.substring(0, 8);

    const expiryHours = this.config.get<number>(
      'INVITATION_EXPIRY_HOURS',
      72,
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Wrap uniqueness checks + save in transaction to prevent TOCTOU races
    const saved = await this.dataSource.transaction(async (manager) => {
      const txUserRepo = manager.getRepository(UserEntity);
      const txInvitationRepo = manager.getRepository(InvitationEntity);

      // Global email uniqueness check (cross-tenant, bypasses RLS)
      const existingUser = await txUserRepo.findOne({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Prevent duplicate pending invitations for same email + tenant
      const existingInvitation = await txInvitationRepo.findOne({
        where: {
          email: dto.email,
          tenantId,
          status: InvitationStatus.PENDING,
        },
      });
      if (existingInvitation) {
        throw new ConflictException(
          'A pending invitation already exists for this email in this tenant',
        );
      }

      const invitation = txInvitationRepo.create({
        email: dto.email,
        tokenHash,
        tokenPrefix,
        tenantId,
        role: dto.role as UserRole,
        invitedBy: inviterId,
        inviterName,
        name: dto.name || undefined,
        status: InvitationStatus.PENDING,
        expiresAt,
      });

      return txInvitationRepo.save(invitation);
    });

    // Send invitation email — if it fails, delete the invitation to prevent orphans
    try {
      await this.emailService.sendInvitationEmail(
        dto.email,
        rawToken,
        inviterName,
        tenantName,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send invitation email to ${dto.email}, rolling back invitation`,
        error,
      );
      await this.invitationRepo.remove(saved);
      throw error;
    }

    return this.toResponse(saved);
  }

  async accept(dto: AcceptInvitationDto): Promise<void> {
    // Wrap entire accept flow in a transaction to prevent race conditions
    await this.dataSource.transaction(async (manager) => {
      const invitationRepo = manager.getRepository(InvitationEntity);
      const userRepo = manager.getRepository(UserEntity);

      // Use token prefix to narrow search instead of scanning all pending invitations
      const tokenPrefix = dto.token.substring(0, 8);
      const candidates = await invitationRepo.find({
        where: { status: InvitationStatus.PENDING, tokenPrefix },
      });

      let matchedInvitation: InvitationEntity | null = null;
      for (const invitation of candidates) {
        const isMatch = await bcrypt.compare(dto.token, invitation.tokenHash);
        if (isMatch) {
          matchedInvitation = invitation;
          break;
        }
      }

      if (!matchedInvitation) {
        throw new BadRequestException('Invalid or expired invitation');
      }

      // Check expiry
      if (new Date() > matchedInvitation.expiresAt) {
        matchedInvitation.status = InvitationStatus.EXPIRED;
        await invitationRepo.save(matchedInvitation);
        throw new BadRequestException('Invalid or expired invitation');
      }

      // Check global email uniqueness before creating user
      const existingUser = await userRepo.findOne({
        where: { email: matchedInvitation.email },
      });
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      // Create user record directly (cross-tenant exemption pattern — same as AuthService)
      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = userRepo.create({
        email: matchedInvitation.email,
        passwordHash,
        role: matchedInvitation.role,
        name: matchedInvitation.name,
        tenantId: matchedInvitation.tenantId,
        status: UserStatus.ACTIVE,
      });
      await userRepo.save(user);

      // Update invitation status
      matchedInvitation.status = InvitationStatus.ACCEPTED;
      await invitationRepo.save(matchedInvitation);

      this.logger.log(
        `Invitation accepted: ${matchedInvitation.email} joined tenant ${matchedInvitation.tenantId}`,
      );
    });
  }

  async resend(invitationId: string, tenantId: string): Promise<void> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending invitations can be resent',
      );
    }

    // Save old token data for rollback if email fails
    const oldTokenHash = invitation.tokenHash;
    const oldTokenPrefix = invitation.tokenPrefix;
    const oldExpiresAt = invitation.expiresAt;

    // Generate new token with prefix
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const tokenPrefix = rawToken.substring(0, 8);

    const expiryHours = this.config.get<number>(
      'INVITATION_EXPIRY_HOURS',
      72,
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    invitation.tokenHash = tokenHash;
    invitation.tokenPrefix = tokenPrefix;
    invitation.expiresAt = expiresAt;
    await this.invitationRepo.save(invitation);

    // Look up tenant name for email
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
    });
    const tenantName = tenant?.name || 'your organization';

    // Resend email — if it fails, rollback token changes
    try {
      await this.emailService.sendInvitationEmail(
        invitation.email,
        rawToken,
        invitation.inviterName || 'Admin',
        tenantName,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resend invitation email to ${invitation.email}, rolling back token`,
        error,
      );
      invitation.tokenHash = oldTokenHash;
      invitation.tokenPrefix = oldTokenPrefix;
      invitation.expiresAt = oldExpiresAt;
      await this.invitationRepo.save(invitation);
      throw error;
    }

    this.logger.log(`Invitation resent to ${invitation.email}`);
  }

  async revoke(invitationId: string, tenantId: string): Promise<void> {
    const invitation = await this.invitationRepo.findOne({
      where: { id: invitationId, tenantId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending invitations can be revoked',
      );
    }

    invitation.status = InvitationStatus.REVOKED;
    await this.invitationRepo.save(invitation);

    this.logger.log(`Invitation revoked for ${invitation.email}`);
  }

  async findAllByTenant(tenantId: string): Promise<InvitationResponseDto[]> {
    const invitations = await this.invitationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    return invitations.map((inv) => this.toResponse(inv));
  }

  private toResponse(invitation: InvitationEntity): InvitationResponseDto {
    const dto = new InvitationResponseDto();
    dto.id = invitation.id;
    dto.email = invitation.email;
    dto.role = invitation.role;
    dto.status = invitation.status;
    dto.invitedBy = invitation.invitedBy;
    dto.inviterName = invitation.inviterName;
    dto.expiresAt = invitation.expiresAt.toISOString();
    dto.createdAt = invitation.createdAt.toISOString();
    return dto;
  }
}
