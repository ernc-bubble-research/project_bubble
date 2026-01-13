import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TransactionManager = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.transactionManager;
    },
);
