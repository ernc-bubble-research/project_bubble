/**
 * Browser-safe shim for @nestjs/swagger.
 *
 * The shared DTO classes use @ApiProperty / @ApiPropertyOptional decorators
 * for Swagger documentation on the server. In the browser, these decorators
 * are dead code — they only add metadata that Swagger reads at runtime on
 * the NestJS server.
 *
 * This shim provides no-op decorator factories so the DTOs can be imported
 * in the Angular app without pulling in @nestjs/common, swagger-ui-dist,
 * or any other Node.js-only packages.
 *
 * Used via tsconfig.app.json path alias:
 *   "@nestjs/swagger" → this file
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** No-op property decorator factory (replaces @ApiProperty) */
export function ApiProperty(_options?: any): PropertyDecorator {
  return () => {
    /* noop */
  };
}

/** No-op property decorator factory (replaces @ApiPropertyOptional) */
export function ApiPropertyOptional(_options?: any): PropertyDecorator {
  return () => {
    /* noop */
  };
}
