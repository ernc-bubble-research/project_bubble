/**
 * Web-safe entry point for @project-bubble/shared.
 * Exports constants, types (interfaces, type aliases), and pure functions (validators).
 * Does NOT export DTO classes that depend on class-validator, class-transformer, or @nestjs/swagger.
 *
 * Usage in Angular/Vite apps:
 *   import { validateWorkflowDefinition } from '@project-bubble/shared/web';
 *   import type { WorkflowDefinition } from '@project-bubble/shared/web';
 */
export * from './lib/constants';
export * from './lib/types';
export * from './lib/validators';
