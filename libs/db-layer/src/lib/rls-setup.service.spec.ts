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

    // 3 calls for enableRls(users) + 1 call for createAuthSelectPolicy
    expect(dataSource.query).toHaveBeenCalledTimes(4);
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" FORCE ROW LEVEL SECURITY',
    );
    // Third call is the DO block for tenant isolation policy
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_users'),
    );
    // Fourth call creates the auth_select_all permissive SELECT policy
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_select_all'),
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
