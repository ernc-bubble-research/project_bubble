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
  status: 'pending' | 'processing' | 'retrying' | 'completed' | 'failed';
  assembledPrompt?: string;
  rawLlmResponse?: string;
  errorMessage?: string;
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  outputAssetId?: string;
  retryAttempt?: number;
  maxRetries?: number;
}

export interface WorkflowJobPayload {
  runId?: string; // Optional for test runs (test runs use sessionId instead)
  sessionId?: string; // Present only for test runs
  isTestRun?: boolean; // Flag to indicate test run (ephemeral, no credit deduction)
  tenantId: string;
  versionId: string;
  definition: WorkflowDefinition;
  contextInputs: Record<string, WorkflowJobContextInput>;
  subjectFile?: WorkflowJobSubjectFile;
  subjectFiles?: WorkflowJobSubjectFile[];
  knowledgeContext?: string;
}
