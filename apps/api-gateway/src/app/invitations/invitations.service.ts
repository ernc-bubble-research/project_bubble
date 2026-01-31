import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(
    dto: InviteUserDto,
    tenantId: string,
    inviterId: string,
    inviterName: string,
  ): Promise<InvitationResponseDto> {
    // AC4: Global email uniqueness check (cross-tenant, bypasses RLS)
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Prevent duplicate pending invitations for same email + tenant
    const existingInvitation = await this.invitationRepo.findOne({
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

    // Look up tenant name for email
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

    const invitation = this.invitationRepo.create({
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

    const saved = await this.invitationRepo.save(invitation);

    // Send invitation email
    await this.emailService.sendInvitationEmail(
      dto.email,
      rawToken,
      inviterName,
      tenantName,
    );

    return this.toResponse(saved);
  }

  async accept(dto: AcceptInvitationDto): Promise<void> {
    // Use token prefix to narrow search instead of scanning all pending invitations
    const tokenPrefix = dto.token.substring(0, 8);
    const candidates = await this.invitationRepo.find({
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
      await this.invitationRepo.save(matchedInvitation);
      throw new BadRequestException('Invalid or expired invitation');
    }

    // Check global email uniqueness before creating user
    const existingUser = await this.userRepo.findOne({
      where: { email: matchedInvitation.email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // Create user record directly (cross-tenant exemption pattern — same as AuthService)
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: matchedInvitation.email,
      passwordHash,
      role: matchedInvitation.role,
      name: matchedInvitation.name,
      tenantId: matchedInvitation.tenantId,
      status: UserStatus.ACTIVE,
    });
    await this.userRepo.save(user);

    // Update invitation status
    matchedInvitation.status = InvitationStatus.ACCEPTED;
    await this.invitationRepo.save(matchedInvitation);

    this.logger.log(
      `Invitation accepted: ${matchedInvitation.email} joined tenant ${matchedInvitation.tenantId}`,
    );
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

    // Resend email
    await this.emailService.sendInvitationEmail(
      invitation.email,
      rawToken,
      invitation.inviterName || 'Admin',
      tenantName,
    );

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
