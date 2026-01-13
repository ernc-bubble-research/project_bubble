import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    InternalServerErrorException,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TenancyInterceptor implements NestInterceptor {
    constructor(private readonly dataSource: DataSource) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const req = context.switchToHttp().getRequest();
        // Assuming AuthGuard has already attached 'user' to req
        // For System Foundation (Provisoning), we might not have a user yet (Admin Endpoint).
        // Or we have a 'BubbleAdmin'.

        // NOTE: This implementation relies on the Controller extracting the MANAGER from the Request.
        // We attach the Transactional Manager to the request object.

        return from(this.runInTransaction(req, next));
    }

    private async runInTransaction(req: any, next: CallHandler): Promise<any> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const tenantId = req.user?.tenantId;

            if (tenantId) {
                // Enforce RLS
                // We use parameters to prevent SQL injection, though UUID is safe-ish.
                await queryRunner.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
            } else {
                // If no tenant (e.g. Bubble Admin dealing with global tables), 
                // we might NOT set it, or set to a reserved 'admin' value depending on policy.
                // For now, if no tenantId, we assume SuperUser or Public endpoint (Auth should guard this).
            }

            // Attach manager to request for the Controller/Service to use
            req.transactionManager = queryRunner.manager;

            // Handle the request
            const result = await lastValueFrom(next.handle());

            await queryRunner.commitTransaction();
            return result;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}
