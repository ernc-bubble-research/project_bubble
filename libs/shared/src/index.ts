/**
 * Server-side entry point for @project-bubble/shared.
 * Exports everything: constants, DTOs (class-validator/class-transformer decorated), types, and validators.
 *
 * WARNING: Do NOT import from this barrel in browser code (apps/web/).
 * DTO classes depend on class-transformer which calls Reflect.getMetadata() — unavailable in browser.
 * Use @project-bubble/shared/web for runtime imports, or `import type` for type-only imports.
 * ESLint rule @typescript-eslint/no-restricted-imports enforces this in apps/web/.
 */
export * from './lib/constants';
export * from './lib/dtos';
export * from './lib/types';
export * from './lib/validators';
