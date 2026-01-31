import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RlsSetupService } from './rls-setup.service';

describe('RlsSetupService', () => {
  let service: RlsSetupService;
  let dataSource: jest.Mocked<DataSource>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RlsSetupService(dataSource, configService);
  });

  it('should execute RLS SQL on module init in development mode', async () => {
    configService.get.mockReturnValue('development');

    await service.onModuleInit();

    // 3 calls for enableRls(users) + 3 calls for enableRls(invitations)
    // + 1 createAuthSelectPolicy + 1 createAuthAcceptInvitationsPolicy
    // + 1 createAuthInsertUsersPolicy + 1 createAuthUpdateInvitationsPolicy
    expect(dataSource.query).toHaveBeenCalledTimes(10);
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" FORCE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_users'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_invitations'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_select_all'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_accept_invitations'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_insert_users'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_update_invitations'),
    );
  });

  it('should skip RLS setup in production', async () => {
    configService.get.mockReturnValue('production');

    await service.onModuleInit();

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should skip RLS setup in test environment', async () => {
    configService.get.mockReturnValue('test');

    await service.onModuleInit();

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('should propagate database errors', async () => {
    configService.get.mockReturnValue('development');
    dataSource.query.mockRejectedValue(new Error('DB connection failed'));

    await expect(service.onModuleInit()).rejects.toThrow(
      'DB connection failed',
    );
  });
});
