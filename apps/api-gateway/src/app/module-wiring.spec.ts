/**
 * Module Wiring Tests — Tier 1: Compilation
 *
 * Verifies that all NestJS modules compile successfully with real providers.
 * Uses real module imports (not mocked) to catch:
 * - Missing provider registrations
 * - Circular dependency issues
 * - Unregistered TypeORM entities
 * - Missing module exports
 *
 * Strategy: Provide a real PostgreSQL connection via .env.test to a dedicated
 * wiring test database. This catches both DI resolution AND entity registration
 * issues in a single pass.
 *
 * Prerequisites: Docker PostgreSQL running (docker-compose up -d)
 */
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createTestDatabase, dropTestDatabase, buildTestDbUrl } from './test-db-helpers';

import {
  DbLayerModule,
  TransactionManager,
  TenantEntity,
  UserEntity,
  InvitationEntity,
  AssetEntity,
  FolderEntity,
  KnowledgeChunkEntity,
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  WorkflowChainEntity,
  WorkflowRunEntity,
  LlmModelEntity,
  LlmProviderConfigEntity,
} from '@project-bubble/db-layer';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { TenantsModule } from './tenants/tenants.module';
import { TenantsService } from './tenants/tenants.service';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';
import { InvitationsModule } from './invitations/invitations.module';
import { InvitationsService } from './invitations/invitations.service';
import { AssetsModule } from './assets/assets.module';
import { AssetsService } from './assets/assets.service';
import { FoldersService } from './assets/folders.service';
import { IngestionModule } from './ingestion/ingestion.module';
import { IngestionService } from './ingestion/ingestion.service';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { KnowledgeSearchService } from './knowledge/knowledge-search.service';
import { WorkflowsModule } from './workflows/workflows.module';
import { WorkflowTemplatesService } from './workflows/workflow-templates.service';
import { WorkflowChainsService } from './workflows/workflow-chains.service';
import { LlmModelsService } from './workflows/llm-models.service';
import { SettingsModule } from './settings/settings.module';
import { LlmProviderConfigService } from './settings/llm-provider-config.service';
import { EmailModule } from './email/email.module';
import { EmailService } from './email/email.service';

// Load test env vars
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.test') });

const ALL_ENTITIES = [
  TenantEntity,
  UserEntity,
  InvitationEntity,
  AssetEntity,
  FolderEntity,
  KnowledgeChunkEntity,
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  WorkflowChainEntity,
  WorkflowRunEntity,
  LlmModelEntity,
  LlmProviderConfigEntity,
];

const TEST_DB_NAME = 'project_bubble_wiring_test';

/** Shared root imports for individual module compilation tests */
function createRootImports() {
  const dbUrl = buildTestDbUrl(TEST_DB_NAME);

  return [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          DATABASE_URL: dbUrl,
          POSTGRES_HOST: process.env['POSTGRES_HOST'] || 'localhost',
          POSTGRES_PORT: process.env['POSTGRES_PORT'] || '5432',
          POSTGRES_USER: process.env['POSTGRES_USER'] || 'bubble_user',
          POSTGRES_PASSWORD: process.env['POSTGRES_PASSWORD'] || 'bubble_password',
          POSTGRES_DB: TEST_DB_NAME,
          REDIS_HOST: process.env['REDIS_HOST'] || 'localhost',
          REDIS_PORT: process.env['REDIS_PORT'] || '6379',
          NODE_ENV: 'test',
          JWT_SECRET: 'wiring-test-secret',
          ADMIN_API_KEY: 'wiring-test-admin-key',
          SEED_ADMIN_EMAIL: 'admin@bubble.io',
          SEED_ADMIN_PASSWORD: 'Admin123!',
          SETTINGS_ENCRYPTION_KEY: process.env['SETTINGS_ENCRYPTION_KEY'] || 'dGVzdA==',
          EMBEDDING_PROVIDER: 'mock',
          EMBEDDING_MODEL: 'text-embedding-004',
          SMTP_HOST: 'localhost',
          SMTP_PORT: '2525',
          SMTP_USER: 'test',
          SMTP_PASS: 'test',
          SMTP_FROM: 'noreply@test.io',
          FRONTEND_URL: 'http://localhost:4200',
          INVITATION_EXPIRY_HOURS: '72',
          CHUNK_SIZE: '2000',
          CHUNK_OVERLAP: '400',
        }),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('DATABASE_URL'),
        entities: ALL_ENTITIES,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    DbLayerModule,
  ];
}

describe('Module Wiring — Tier 1 Compilation [P0]', () => {
  // Create test DB once before all tests, drop after
  beforeAll(async () => {
    await createTestDatabase(TEST_DB_NAME);
  }, 30_000);

  afterAll(async () => {
    await dropTestDatabase(TEST_DB_NAME);
  }, 15_000);

  it('[MW-1-UNIT-001] [P0] EmailModule compiles with real providers', async () => {
    // EmailModule needs ConfigModule (global in AppModule, so must provide here for isolation test)
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EmailModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(EmailService)).toBeDefined();
    await module.close();
  });

  it('[MW-1-UNIT-002] [P0] UsersModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        UsersModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(UsersService)).toBeDefined();
    expect(module.get(TransactionManager)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-003] [P0] AssetsModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        AssetsModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(AssetsService)).toBeDefined();
    expect(module.get(FoldersService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-004] [P0] SettingsModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        SettingsModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(LlmProviderConfigService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-005] [P0] WorkflowsModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        WorkflowsModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(WorkflowTemplatesService)).toBeDefined();
    expect(module.get(WorkflowChainsService)).toBeDefined();
    expect(module.get(LlmModelsService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-006] [P0] AuthModule compiles with real providers (including forwardRef to InvitationsModule)', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        AuthModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(AuthService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-007] [P0] InvitationsModule compiles with real providers', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        InvitationsModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(InvitationsService)).toBeDefined();
    expect(module.get(EmailService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-008] [P0] IngestionModule compiles with real providers (including BullMQ queue)', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        IngestionModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(IngestionService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-009] [P0] KnowledgeModule compiles with real providers (imports IngestionModule)', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        IngestionModule, // Required by KnowledgeModule
        KnowledgeModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(KnowledgeSearchService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-010] [P0] TenantsModule compiles with real providers (heaviest cross-deps: AuthModule + WorkflowsModule)', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ...createRootImports(),
        TenantsModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(TenantsService)).toBeDefined();
    // Verify cross-module deps resolved
    expect(module.get(AuthService)).toBeDefined();
    expect(module.get(WorkflowTemplatesService)).toBeDefined();
    await module.close();
  }, 15_000);

  it('[MW-1-UNIT-011] [P0] Full AppModule compiles with all feature modules', async () => {
    // Import AppModule directly — it includes its own root config
    // Override DATABASE_URL to point to wiring test DB
    process.env['DATABASE_URL'] = `postgresql://${process.env['POSTGRES_USER'] || 'bubble_user'}:${process.env['POSTGRES_PASSWORD'] || 'bubble_password'}@${process.env['POSTGRES_HOST'] || 'localhost'}:${process.env['POSTGRES_PORT'] || 5432}/${TEST_DB_NAME}`;
    process.env['NODE_ENV'] = 'test';
    process.env['JWT_SECRET'] = 'wiring-test-secret';
    process.env['ADMIN_API_KEY'] = 'wiring-test-admin-key';
    process.env['SETTINGS_ENCRYPTION_KEY'] = 'dGVzdA==';
    process.env['EMBEDDING_PROVIDER'] = 'mock';

    // Import AppModule lazily to pick up the env overrides
    const { AppModule } = await import('./app.module');

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module).toBeDefined();

    // Verify key providers from all modules are available
    expect(module.get(AuthService)).toBeDefined();
    expect(module.get(TenantsService)).toBeDefined();
    expect(module.get(UsersService)).toBeDefined();
    expect(module.get(InvitationsService)).toBeDefined();
    expect(module.get(AssetsService)).toBeDefined();
    expect(module.get(IngestionService)).toBeDefined();
    expect(module.get(KnowledgeSearchService)).toBeDefined();
    expect(module.get(WorkflowTemplatesService)).toBeDefined();
    expect(module.get(LlmProviderConfigService)).toBeDefined();
    expect(module.get(TransactionManager)).toBeDefined();

    await module.close();
  }, 30_000);
});
