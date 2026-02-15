import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IMPERSONATOR_ROLE } from '@project-bubble/db-layer';
import { SupportAccessService } from '../support-access/support-access.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class SupportMutationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SupportMutationInterceptor.name);

  constructor(private readonly supportAccessService: SupportAccessService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const user = request.user;

    if (
      !user ||
      user.role !== IMPERSONATOR_ROLE ||
      !MUTATING_METHODS.has(request.method)
    ) {
      return next.handle();
    }

    const sessionId: string | undefined = user.sessionId;
    if (!sessionId) {
      return next.handle();
    }

    const method: string = request.method;
    const urlPath: string = request.originalUrl || request.url;

    return next.handle().pipe(
      tap({
        complete: () => {
          const statusCode: number = response.statusCode;
          this.logMutationSafe(sessionId, method, urlPath, statusCode);
        },
        error: () => {
          const statusCode: number = response.statusCode || 500;
          this.logMutationSafe(sessionId, method, urlPath, statusCode);
        },
      }),
    );
  }

  private logMutationSafe(
    sessionId: string,
    method: string,
    urlPath: string,
    statusCode: number,
  ): void {
    this.supportAccessService
      .logMutation(sessionId, method, urlPath, statusCode)
      .catch((err) => {
        this.logger.warn(
          `Mutation logging failed for session=${sessionId}: ${err.message}`,
        );
      });
  }
}
