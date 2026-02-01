import { TextExtractorService } from './text-extractor.service';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    text: 'Extracted PDF text content',
    numpages: 3,
  });
});

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({
    value: 'Extracted DOCX text content',
  }),
}));

describe('TextExtractorService [2.2-UNIT-001] [P1]', () => {
  let service: TextExtractorService;
  let mockReadFile: jest.Mock;

  beforeEach(() => {
    service = new TextExtractorService();
    const fs = jest.requireMock('fs/promises');
    mockReadFile = fs.readFile;
    mockReadFile.mockReset();
  });

  describe('extract()', () => {
    it('[2.2-UNIT-001a] should extract text from PDF files', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('fake pdf'));

      const result = await service.extract('/path/to/file.pdf', 'application/pdf');

      expect(result.text).toBe('Extracted PDF text content');
      expect(result.pages).toBe(3);
    });

    it('[2.2-UNIT-001b] should extract text from TXT files', async () => {
      mockReadFile.mockResolvedValue('Plain text content');

      const result = await service.extract('/path/to/file.txt', 'text/plain');

      expect(result.text).toBe('Plain text content');
      expect(result.pages).toBeUndefined();
    });

    it('[2.2-UNIT-001c] should extract text from MD files', async () => {
      mockReadFile.mockResolvedValue('# Markdown content');

      const result = await service.extract('/path/to/file.md', 'text/markdown');

      expect(result.text).toBe('# Markdown content');
    });

    it('[2.2-UNIT-001d] should extract text from DOCX files', async () => {
      mockReadFile.mockResolvedValue(Buffer.from('fake docx'));

      const result = await service.extract(
        '/path/to/file.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      expect(result.text).toBe('Extracted DOCX text content');
    });

    it('[2.2-UNIT-001e] should throw error for unsupported MIME types', async () => {
      await expect(
        service.extract('/path/to/file.jpg', 'image/jpeg'),
      ).rejects.toThrow('Unsupported file type for text extraction: image/jpeg');
    });
  });
});
