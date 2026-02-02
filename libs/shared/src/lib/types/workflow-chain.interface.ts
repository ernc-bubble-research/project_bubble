/**
 * TypeScript interfaces for Workflow Chain Composition.
 * Matches tech spec §3.1 Chain Definition Schema and §3.3 Chain Input Mapping Rules.
 * Stored as JSONB in workflow_chains.definition column.
 */

export interface ChainDefinition {
  metadata: ChainMetadata;
  steps: ChainStep[];
}

export interface ChainMetadata {
  name: string;
  description: string;
}

export interface ChainStep {
  workflow_id: string;
  alias: string;
  input_mapping?: Record<string, ChainInputSource>;
}

export interface ChainInputSource {
  /** Reference a previous step's outputs */
  from_step?: string;
  from_output?: 'outputs';

  /** Inherit from chain initial inputs */
  from_input?: string;

  /** Fixed value set at chain definition time */
  from_chain_config?: boolean;
  value?: string;
}
