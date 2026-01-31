export class InvitationResponseDto {
  id!: string;
  email!: string;
  role!: string;
  status!: string;
  invitedBy!: string;
  inviterName?: string;
  expiresAt!: string;
  createdAt!: string;
}
