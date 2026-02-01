import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExtractedText {
  text: string;
  pages?: number;
}

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  async extract(filePath: string, mimeType: string): Promise<ExtractedText> {
    this.logger.log(
      `Extracting text from ${path.basename(filePath)} (${mimeType})`,
    );

    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdf(filePath);
      case 'text/plain':
      case 'text/markdown':
        return this.extractPlainText(filePath);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDocx(filePath);
      default:
        throw new Error(`Unsupported file type for text extraction: ${mimeType}`);
    }
  }

  private async extractPdf(filePath: string): Promise<ExtractedText> {
    // pdf-parse expects a Buffer
    const buffer = await fs.readFile(filePath);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pages: data.numpages,
    };
  }

  private async extractPlainText(filePath: string): Promise<ExtractedText> {
    const text = await fs.readFile(filePath, 'utf-8');
    return { text };
  }

  private async extractDocx(filePath: string): Promise<ExtractedText> {
    const buffer = await fs.readFile(filePath);
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value };
  }
}
