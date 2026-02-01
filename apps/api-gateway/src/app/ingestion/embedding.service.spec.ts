import { ConfigService } from '@nestjs/config';
import { MockEmbeddingProvider, GeminiEmbeddingProvider } from './embedding.service';

describe('MockEmbeddingProvider [2.2-UNIT-003] [P1]', () => {
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    provider = new MockEmbeddingProvider();
  });

  it('[2.2-UNIT-003a] should return vectors for each input text', async () => {
    const texts = ['Hello world', 'Test text'];
    const result = await provider.embed(texts);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(768);
    expect(result[1]).toHaveLength(768);
  });

  it('[2.2-UNIT-003b] should return deterministic vectors for same input', async () => {
    const result1 = await provider.embed(['Same text']);
    const result2 = await provider.embed(['Same text']);

    expect(result1[0]).toEqual(result2[0]);
  });

  it('[2.2-UNIT-003c] should return different vectors for different inputs', async () => {
    const result = await provider.embed(['Text A', 'Text B']);

    expect(result[0]).not.toEqual(result[1]);
  });

  it('[2.2-UNIT-003d] should return unit-normalized vectors', async () => {
    const result = await provider.embed(['Test text']);
    const magnitude = Math.sqrt(
      result[0].reduce((sum, v) => sum + v * v, 0),
    );

    expect(magnitude).toBeCloseTo(1.0, 4);
  });

  it('[2.2-UNIT-003e] should handle empty array', async () => {
    const result = await provider.embed([]);
    expect(result).toEqual([]);
  });
});

describe('GeminiEmbeddingProvider [2.2-UNIT-004] [P1]', () => {
  it('[2.2-UNIT-004a] should throw if GEMINI_API_KEY is missing', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new GeminiEmbeddingProvider(config)).toThrow(
      'Embedding requires a valid GEMINI_API_KEY',
    );
  });

  it('[2.2-UNIT-004b] should throw if GEMINI_API_KEY is default placeholder', () => {
    const config = {
      get: jest.fn().mockReturnValue('replace_with_real_key'),
    } as unknown as ConfigService;

    expect(() => new GeminiEmbeddingProvider(config)).toThrow(
      'Embedding requires a valid GEMINI_API_KEY',
    );
  });
});
