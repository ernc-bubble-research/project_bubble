import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// Mock nodemailer
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('EmailService [P1]', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: unknown) => {
      const config: Record<string, unknown> = {
        SMTP_HOST: 'smtp.test.io',
        SMTP_PORT: 2525,
        SMTP_USER: 'testuser',
        SMTP_PASS: 'testpass',
        SMTP_FROM: 'test@bubble.app',
        FRONTEND_URL: 'http://localhost:4200',
      };
      return config[key] ?? defaultVal;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('[1H.1-UNIT-001] should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendInvitationEmail', () => {
    it('[1H.1-UNIT-002] should send an email with correct parameters', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-123' });

      await service.sendInvitationEmail(
        'bob@example.com',
        'test-token-123',
        'Alice',
        'Acme Corp',
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.to).toBe('bob@example.com');
      expect(callArgs.from).toBe('test@bubble.app');
      expect(callArgs.subject).toContain('Acme Corp');
      expect(callArgs.html).toContain('test-token-123');
      expect(callArgs.html).toContain('Alice');
      expect(callArgs.html).toContain('Acme Corp');
      expect(callArgs.html).toContain('http://localhost:4200/auth/set-password');
    });

    it('[1H.1-UNIT-003] should throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendInvitationEmail('bob@example.com', 'token', 'Alice', 'Acme'),
      ).rejects.toThrow('SMTP error');
    });
  });
});
