/**
 * TypeScript interfaces for the Atomic Workflow Definition Schema.
 * Matches tech spec §1.1 YAML schema and §1.2 Schema Field Reference exactly.
 * Stored as JSONB in workflow_versions.definition column.
 */

export interface WorkflowDefinition {
  metadata: WorkflowMetadata;
  inputs: WorkflowInput[];
  execution: WorkflowExecution;
  knowledge: WorkflowKnowledge;
  prompt: string;
  output: WorkflowOutput;
}

export interface WorkflowMetadata {
  name: string;
  description: string;
  version: number;
  tags?: string[];
}

export type WorkflowInputRole = 'context' | 'subject';
export type WorkflowInputSourceType = 'asset' | 'upload' | 'text';

export interface WorkflowInput {
  name: string;
  label: string;
  role: WorkflowInputRole;
  source: WorkflowInputSourceType[];
  required: boolean;
  description?: string;
  accept?: WorkflowAcceptConfig;
  text_config?: WorkflowTextConfig;
}

export interface WorkflowAcceptConfig {
  extensions?: string[];
  max_size_mb?: number;
}

export interface WorkflowTextConfig {
  placeholder?: string;
  max_length?: number;
}

export type WorkflowProcessingMode = 'parallel' | 'batch';

export interface WorkflowExecution {
  processing: WorkflowProcessingMode;
  max_concurrency?: number;
  model: string;
  temperature?: number;
  max_output_tokens?: number;
  max_retries?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
}

export type WorkflowQueryStrategy = 'auto' | 'custom';

export interface WorkflowKnowledge {
  enabled: boolean;
  query_strategy?: WorkflowQueryStrategy;
  query_template?: string;
  max_chunks?: number;
  similarity_threshold?: number;
}

export type WorkflowOutputFormat = 'markdown' | 'json';

export interface WorkflowOutput {
  format: WorkflowOutputFormat;
  filename_template: string;
  sections?: WorkflowOutputSection[];
  json_schema?: Record<string, unknown>;
}

export interface WorkflowOutputSection {
  name: string;
  label: string;
  required: boolean;
}

/**
 * Maps snake_case generation param keys (WorkflowExecution) → camelCase keys
 * (LLMGenerateOptions / GenerationParamSpec / model defaults).
 *
 * Single source of truth — used by both backend merge utility and frontend wizard.
 * When adding a new generation param, add ONE entry here.
 */
export const GENERATION_PARAM_KEY_MAP: Readonly<Record<string, string>> = Object.freeze({
  temperature: 'temperature',
  max_output_tokens: 'maxOutputTokens',
  top_p: 'topP',
  top_k: 'topK',
  stop_sequences: 'stopSequences',
});
