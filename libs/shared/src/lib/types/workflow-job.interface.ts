/**
 * TypeScript interfaces for Workflow Job Payloads.
 * Matches tech spec §7.2 Job Payload Schema.
 * Used as BullMQ job data for workflow execution.
 */

import { WorkflowDefinition } from './workflow-definition.interface';

export interface WorkflowJobContextInput {
  type: 'file' | 'text';
  assetId?: string;
  content?: string;
  storagePath?: string;
}

export interface WorkflowJobSubjectFile {
  assetId?: string;
  originalName: string;
  storagePath: string;
}

export interface PerFileResult {
  index: number;
  fileName: string;
  status: 'completed' | 'failed';
  assembledPrompt?: string;
  rawLlmResponse?: string;
  errorMessage?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface WorkflowJobPayload {
  runId: string;
  tenantId: string;
  versionId: string;
  definition: WorkflowDefinition;
  contextInputs: Record<string, WorkflowJobContextInput>;
  subjectFile?: WorkflowJobSubjectFile;
  subjectFiles?: WorkflowJobSubjectFile[];
  knowledgeContext?: string;
}
