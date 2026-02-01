import { Injectable } from '@nestjs/common';

export interface TextChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    charStart: number;
    charEnd: number;
  };
}

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

const DEFAULT_CHUNK_SIZE = 2000; // ~500 tokens
const DEFAULT_OVERLAP = 400; // ~100 tokens
const MIN_CHUNK_SIZE = 100;

@Injectable()
export class ChunkerService {
  /**
   * Sanitize extracted text before chunking/embedding.
   * Strips null bytes, control characters (except newline/tab),
   * and collapses excessive whitespace.
   */
  sanitize(text: string): string {
    return text
      .replace(/\0/g, '') // null bytes
      // eslint-disable-next-line no-control-regex
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (preserve \t \n \r)
      .replace(/\r\n/g, '\n') // normalize line endings
      .replace(/ {3,}/g, '  ') // collapse excessive spaces (keep up to 2)
      .trim();
  }

  chunk(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap ?? DEFAULT_OVERLAP;

    const sanitized = this.sanitize(text);
    if (!sanitized || sanitized.length === 0) {
      return [];
    }

    // If text fits in a single chunk, return it directly
    if (sanitized.length <= chunkSize) {
      return [
        {
          content: sanitized,
          chunkIndex: 0,
          metadata: { charStart: 0, charEnd: sanitized.length },
        },
      ];
    }

    const chunks: TextChunk[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < sanitized.length) {
      let end = Math.min(start + chunkSize, sanitized.length);

      // If we're not at the end of the text, try to find a good break point
      if (end < sanitized.length) {
        end = this.findBreakPoint(sanitized, start, end);
      }

      const content = sanitized.slice(start, end);

      // Skip tiny trailing fragments
      if (content.trim().length >= MIN_CHUNK_SIZE || chunks.length === 0) {
        chunks.push({
          content,
          chunkIndex,
          metadata: { charStart: start, charEnd: end },
        });
        chunkIndex++;
      }

      // Move start forward, accounting for overlap
      const nextStart = end - overlap;
      // Ensure we always make forward progress
      start = nextStart <= start ? end : nextStart;
    }

    return chunks;
  }

  private findBreakPoint(
    text: string,
    start: number,
    end: number,
  ): number {
    // Search backward from end for a good split point
    const searchRegion = text.slice(start, end);

    // Priority 1: Paragraph break (\n\n)
    const paragraphBreak = searchRegion.lastIndexOf('\n\n');
    if (paragraphBreak > searchRegion.length * 0.5) {
      return start + paragraphBreak + 2; // Include the newlines
    }

    // Priority 2: Sentence end (. followed by space or newline)
    const sentenceMatch = searchRegion.match(/\.\s(?=[A-Z])/g);
    if (sentenceMatch) {
      const lastSentenceEnd = searchRegion.lastIndexOf(
        sentenceMatch[sentenceMatch.length - 1],
      );
      if (lastSentenceEnd > searchRegion.length * 0.5) {
        return start + lastSentenceEnd + 2; // Include ". "
      }
    }

    // Priority 3: Any sentence-ending punctuation followed by space
    for (const pattern of ['. ', '! ', '? ', '.\n']) {
      const idx = searchRegion.lastIndexOf(pattern);
      if (idx > searchRegion.length * 0.3) {
        return start + idx + pattern.length;
      }
    }

    // Priority 4: Word break (space)
    const lastSpace = searchRegion.lastIndexOf(' ');
    if (lastSpace > searchRegion.length * 0.3) {
      return start + lastSpace + 1;
    }

    // Fallback: hard cut at end
    return end;
  }
}
