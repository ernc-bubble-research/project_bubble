export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';
