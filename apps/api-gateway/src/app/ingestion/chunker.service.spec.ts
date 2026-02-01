import { ChunkerService } from './chunker.service';

describe('ChunkerService [2.2-UNIT-002] [P1]', () => {
  let service: ChunkerService;

  beforeEach(() => {
    service = new ChunkerService();
  });

  describe('chunk()', () => {
    it('[2.2-UNIT-002a] should return empty array for empty text', () => {
      const result = service.chunk('');
      expect(result).toEqual([]);
    });

    it('[2.2-UNIT-002b] should return empty array for whitespace-only text', () => {
      const result = service.chunk('   \n\n  ');
      expect(result).toEqual([]);
    });

    it('[2.2-UNIT-002c] should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const result = service.chunk(text);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(text);
      expect(result[0].chunkIndex).toBe(0);
      expect(result[0].metadata.charStart).toBe(0);
      expect(result[0].metadata.charEnd).toBe(text.length);
    });

    it('[2.2-UNIT-002d] should split long text into multiple chunks', () => {
      // Create text longer than default chunk size (2000 chars)
      const sentence = 'This is a test sentence with some content. ';
      const text = sentence.repeat(80); // ~3440 chars

      const result = service.chunk(text);

      expect(result.length).toBeGreaterThan(1);
      // Verify chunk indices are sequential
      result.forEach((chunk, i) => {
        expect(chunk.chunkIndex).toBe(i);
      });
    });

    it('[2.2-UNIT-002e] should respect custom chunk size and overlap', () => {
      const text = 'A'.repeat(500); // 500 chars
      const result = service.chunk(text, { chunkSize: 200, overlap: 50 });

      expect(result.length).toBeGreaterThan(1);
      // First chunk should be 200 chars
      expect(result[0].content.length).toBeLessThanOrEqual(200);
    });

    it('[2.2-UNIT-002f] should have overlapping content between chunks', () => {
      // Create text with distinct paragraphs
      const paragraph = 'This is a paragraph of text that is long enough to be meaningful. ';
      const text = paragraph.repeat(60); // ~3900 chars

      const result = service.chunk(text, { chunkSize: 500, overlap: 100 });

      expect(result.length).toBeGreaterThan(1);

      // Verify each consecutive pair has overlap
      for (let i = 1; i < result.length; i++) {
        // The start of chunk[i] should be before the end of chunk[i-1]
        expect(result[i].metadata.charStart).toBeLessThan(
          result[i - 1].metadata.charEnd,
        );
      }
    });

    it('[2.2-UNIT-002g] should prefer paragraph boundaries for splitting', () => {
      const para1 = 'A'.repeat(1500);
      const para2 = 'B'.repeat(1500);
      const text = `${para1}\n\n${para2}`;

      const result = service.chunk(text, { chunkSize: 2000, overlap: 400 });

      expect(result.length).toBeGreaterThan(1);
      // First chunk should end near the paragraph break
      expect(result[0].content).toContain('A');
    });

    it('[2.2-UNIT-002h] should include correct metadata for each chunk', () => {
      const text = 'Hello world. This is test content. '.repeat(80);
      const result = service.chunk(text);

      for (const chunk of result) {
        expect(chunk.metadata).toHaveProperty('charStart');
        expect(chunk.metadata).toHaveProperty('charEnd');
        expect(typeof chunk.metadata.charStart).toBe('number');
        expect(typeof chunk.metadata.charEnd).toBe('number');
        expect(chunk.metadata.charEnd).toBeGreaterThan(chunk.metadata.charStart);
      }
    });
  });
});
