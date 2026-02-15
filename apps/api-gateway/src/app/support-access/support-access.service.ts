import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SupportAccessLogEntity,
  SupportMutationLogEntity,
} from '@project-bubble/db-layer';

@Injectable()
export class SupportAccessService {
  private readonly logger = new Logger(SupportAccessService.name);
  private readonly accessLogRepo: Repository<SupportAccessLogEntity>;
  private readonly mutationLogRepo: Repository<SupportMutationLogEntity>;

  constructor(
    @InjectDataSource('migration')
    private readonly migrationDs: DataSource,
  ) {
    this.accessLogRepo = this.migrationDs.getRepository(SupportAccessLogEntity);
    this.mutationLogRepo = this.migrationDs.getRepository(SupportMutationLogEntity);
  }

  async logSessionStart(
    sessionId: string,
    adminUserId: string,
    tenantId: string,
    jwtTokenHash: string,
  ): Promise<void> {
    const entry = this.accessLogRepo.create({
      id: sessionId,
      adminUserId,
      tenantId,
      jwtTokenHash,
    });
    await this.accessLogRepo.save(entry);
    this.logger.log(
      `Support session started: admin=${adminUserId} tenant=${tenantId} session=${sessionId}`,
    );
  }

  async logMutation(
    sessionId: string,
    httpMethod: string,
    urlPath: string,
    statusCode: number,
  ): Promise<void> {
    const entry = this.mutationLogRepo.create({
      sessionId,
      httpMethod,
      urlPath,
      statusCode,
    });
    await this.mutationLogRepo.save(entry);
  }

  async logSessionEnd(sessionId: string, adminUserId: string): Promise<void> {
    const session = await this.accessLogRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    if (session.adminUserId !== adminUserId) {
      throw new ForbiddenException('Cannot close another admin\'s session');
    }
    await this.accessLogRepo.update(sessionId, { endedAt: new Date() });
    this.logger.log(`Support session ended: session=${sessionId}`);
  }
}
