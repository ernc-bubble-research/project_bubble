import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'sandbox.smtp.mailtrap.io'),
      port: this.config.get<number>('SMTP_PORT', 2525),
      auth: {
        user: this.config.get<string>('SMTP_USER', ''),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async sendInvitationEmail(
    to: string,
    token: string,
    inviterName: string,
    tenantName: string,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    const from = this.config.get<string>('SMTP_FROM', 'noreply@bubble.app');
    const link = `${frontendUrl}/auth/set-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${tenantName}</h2>
        <p>${inviterName} has invited you to join <strong>${tenantName}</strong> on Bubble.</p>
        <p>Click the button below to set your password and get started:</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${link}"
             style="background-color: #6366f1; color: white; padding: 12px 32px;
                    text-decoration: none; border-radius: 6px; font-weight: 600;">
            Set Your Password
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This link expires in 72 hours. If you didn't expect this invitation, you can ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Bubble — Workflow Automation Platform</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: `You're invited to join ${tenantName} on Bubble`,
        html,
      });
      this.logger.log(`Invitation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send invitation email to ${to}:`, error);
      throw error;
    }
  }
}
