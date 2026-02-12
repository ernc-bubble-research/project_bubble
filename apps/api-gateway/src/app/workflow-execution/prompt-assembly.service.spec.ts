import { PromptAssemblyService } from './prompt-assembly.service';
import { WorkflowJobPayload } from '@project-bubble/shared';

// Mock fs module
jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('File content from fs'),
}));

import * as fs from 'fs/promises';

describe('PromptAssemblyService', () => {
  let service: PromptAssemblyService;
  let txManager: { run: jest.Mock };
  let textExtractor: { extract: jest.Mock };

  function buildPayload(overrides: Partial<WorkflowJobPayload> = {}): WorkflowJobPayload {
    return {
      runId: 'run-1',
      tenantId: 'tenant-1',
      versionId: 'version-1',
      definition: {
        metadata: { name: 'Test', description: 'Test', version: 1 },
        inputs: [],
        execution: { processing: 'parallel', model: 'model-uuid' },
        knowledge: { enabled: false },
        prompt: 'Analyze {report} using {guidelines}',
        output: { format: 'markdown', filename_template: 'output.md' },
      },
      contextInputs: {},
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    txManager = {
      run: jest.fn().mockImplementation((_tenantId, cb) => cb({
        findOne: jest.fn().mockResolvedValue(null),
      })),
    };

    textExtractor = {
      extract: jest.fn().mockResolvedValue({ text: 'Extracted PDF text', pages: 5 }),
    };

    service = new PromptAssemblyService(
      txManager as any,
      textExtractor as any,
    );
  });

  // [4.2-UNIT-033] Text-type context input substitution
  it('should substitute text-type context inputs into prompt template', async () => {
    const payload = buildPayload({
      contextInputs: {
        report: { type: 'text', content: 'Q4 revenue grew 15%' },
        guidelines: { type: 'text', content: 'Focus on profitability' },
      },
    });

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Analyze Q4 revenue grew 15% using Focus on profitability');
    expect(result.warnings).toHaveLength(0);
    expect(result.assembledPromptLength).toBe(result.prompt.length);
  });

  // [4.2-UNIT-034] File-type context input with assetId
  it('should resolve file-type context input via assetId lookup', async () => {
    const mockAsset = {
      id: 'asset-1',
      storagePath: '/uploads/tenant-1/report.pdf',
      mimeType: 'application/pdf',
    };

    txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
      findOne: jest.fn().mockResolvedValue(mockAsset),
    }));

    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', assetId: 'asset-1' },
        guidelines: { type: 'text', content: 'standard guidelines' },
      },
    });

    const result = await service.assemble(payload);

    expect(textExtractor.extract).toHaveBeenCalledWith(
      '/uploads/tenant-1/report.pdf',
      'application/pdf',
    );
    expect(result.prompt).toBe('Analyze Extracted PDF text using standard guidelines');
  });

  // [4.2-UNIT-035] File-type with storagePath (no assetId)
  it('should resolve file-type context input via storagePath with inferred mimeType', async () => {
    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', storagePath: '/uploads/report.txt' },
        guidelines: { type: 'text', content: 'guidelines' },
      },
    });

    const result = await service.assemble(payload);

    // txt files use fs.readFile directly
    expect(fs.readFile).toHaveBeenCalledWith('/uploads/report.txt', 'utf-8');
    expect(result.prompt).toContain('File content from fs');
  });

  // [4.2-UNIT-036] Subject file substitution
  it('should substitute subject file variables', async () => {
    const payload = buildPayload({
      definition: {
        ...buildPayload().definition,
        prompt: 'Analyze {subject_content} (file: {subject_name})',
      },
      subjectFile: {
        originalName: 'report.pdf',
        storagePath: '/uploads/tenant-1/report.pdf',
        assetId: 'asset-subject',
      },
    });

    const mockAsset = {
      id: 'asset-subject',
      storagePath: '/uploads/tenant-1/report.pdf',
      mimeType: 'application/pdf',
    };

    txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
      findOne: jest.fn().mockResolvedValue(mockAsset),
    }));

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Analyze Extracted PDF text (file: report.pdf)');
  });

  // [4.2-UNIT-037] Knowledge context substitution
  it('should substitute knowledge_context variable', async () => {
    const payload = buildPayload({
      definition: {
        ...buildPayload().definition,
        prompt: 'Context: {knowledge_context}. Analyze {report}.',
      },
      contextInputs: {
        report: { type: 'text', content: 'data' },
      },
      knowledgeContext: 'Relevant knowledge chunk',
    });

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Context: Relevant knowledge chunk. Analyze data.');
  });

  // [4.2-UNIT-038] Empty knowledge context defaults to empty string
  it('should default knowledge_context to empty string when not provided', async () => {
    const payload = buildPayload({
      definition: {
        ...buildPayload().definition,
        prompt: 'Knowledge: {knowledge_context}',
      },
    });

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Knowledge: ');
  });

  // [4.2-UNIT-039] Unresolved variables produce warnings
  it('should warn about unresolved variables and replace with empty string', async () => {
    const payload = buildPayload({
      contextInputs: {
        report: { type: 'text', content: 'data' },
      },
      // 'guidelines' is not provided but is in the template
    });

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Analyze data using ');
    expect(result.warnings).toContain('Unresolved variable: {guidelines}');
  });

  // [4.2-UNIT-040] Empty text input produces warning
  it('should warn when text input is empty', async () => {
    const payload = buildPayload({
      contextInputs: {
        report: { type: 'text', content: '' },
        guidelines: { type: 'text', content: 'ok' },
      },
    });

    const result = await service.assemble(payload);

    expect(result.warnings).toContain("Context input 'report' is empty");
  });

  // [4.2-UNIT-041] Asset not found produces warning
  it('should warn when asset is not found for file input', async () => {
    txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
      findOne: jest.fn().mockResolvedValue(null),
    }));

    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', assetId: 'non-existent' },
        guidelines: { type: 'text', content: 'ok' },
      },
    });

    const result = await service.assemble(payload);

    expect(result.warnings).toContain(
      "Asset not found for input 'report' (assetId: non-existent)",
    );
  });

  // [4.2-UNIT-042] File read error produces warning (no crash)
  it('should warn on file read error without crashing', async () => {
    txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
      findOne: jest.fn().mockResolvedValue({
        storagePath: '/bad/path.pdf',
        mimeType: 'application/pdf',
      }),
    }));

    textExtractor.extract.mockRejectedValue(new Error('File not found'));

    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', assetId: 'asset-1' },
        guidelines: { type: 'text', content: 'ok' },
      },
    });

    const result = await service.assemble(payload);

    expect(result.warnings).toContain(
      "Failed to read file for input 'report': File not found",
    );
    expect(result.prompt).toBe('Analyze  using ok');
  });

  // [4.2-UNIT-043] DOCX file extraction
  it('should extract DOCX files via TextExtractorService', async () => {
    txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
      findOne: jest.fn().mockResolvedValue({
        storagePath: '/uploads/doc.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    }));

    textExtractor.extract.mockResolvedValue({ text: 'DOCX content' });

    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', assetId: 'asset-1' },
        guidelines: { type: 'text', content: 'ok' },
      },
    });

    const result = await service.assemble(payload);

    expect(textExtractor.extract).toHaveBeenCalledWith(
      '/uploads/doc.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.prompt).toContain('DOCX content');
  });

  // [4.2-UNIT-044] Prompt length is reported correctly
  it('should report correct assembledPromptLength', async () => {
    const payload = buildPayload({
      definition: {
        ...buildPayload().definition,
        prompt: 'Hello world',
      },
    });

    const result = await service.assemble(payload);

    expect(result.assembledPromptLength).toBe('Hello world'.length);
  });

  // [4.2-UNIT-045] No context inputs — just template with empty substitutions
  it('should handle prompt with no context inputs', async () => {
    const payload = buildPayload({
      definition: {
        ...buildPayload().definition,
        prompt: 'Static prompt with no variables',
      },
    });

    const result = await service.assemble(payload);

    expect(result.prompt).toBe('Static prompt with no variables');
    expect(result.warnings).toHaveLength(0);
  });

  // [4.2-UNIT-046] Infer mimeType from extension
  it('should infer correct mimeType from file extensions', async () => {
    // We can test this indirectly by providing a storagePath without assetId
    const payload = buildPayload({
      contextInputs: {
        report: { type: 'file', storagePath: '/uploads/doc.md' },
        guidelines: { type: 'text', content: 'ok' },
      },
    });

    const result = await service.assemble(payload);

    // .md → text/markdown → read via fs.readFile
    expect(fs.readFile).toHaveBeenCalledWith('/uploads/doc.md', 'utf-8');
    expect(result.prompt).toContain('File content from fs');
  });

  describe('batch mode (subjectFiles)', () => {
    // [4.3-UNIT-060] Batch mode: concatenates multiple subject files with separators
    it('should concatenate multiple subject files with --- File: separators', async () => {
      const mockAsset1 = { storagePath: '/uploads/a.txt', mimeType: 'text/plain' };
      const mockAsset2 = { storagePath: '/uploads/b.txt', mimeType: 'text/plain' };

      let findOneCallCount = 0;
      txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
        findOne: jest.fn().mockImplementation(() => {
          findOneCallCount++;
          return findOneCallCount === 1 ? mockAsset1 : mockAsset2;
        }),
      }));

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce('Content of file A')
        .mockResolvedValueOnce('Content of file B');

      const payload = buildPayload({
        definition: {
          ...buildPayload().definition,
          prompt: 'Analyze: {subject_content}. Files: {subject_name}.',
        },
        subjectFiles: [
          { originalName: 'alpha.txt', storagePath: '/uploads/a.txt', assetId: 'asset-a' },
          { originalName: 'beta.txt', storagePath: '/uploads/b.txt', assetId: 'asset-b' },
        ],
      });

      const result = await service.assemble(payload);

      expect(result.prompt).toContain('--- File: alpha.txt ---');
      expect(result.prompt).toContain('--- File: beta.txt ---');
      expect(result.prompt).toContain('Content of file A');
      expect(result.prompt).toContain('Content of file B');
      expect(result.prompt).toContain('Files: alpha.txt, beta.txt.');
    });

    // [4.3-UNIT-061] Batch mode: subject_name is comma-joined filenames
    it('should set subject_name to comma-joined filenames', async () => {
      txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
        findOne: jest.fn().mockResolvedValue({ storagePath: '/uploads/f.txt', mimeType: 'text/plain' }),
      }));

      (fs.readFile as jest.Mock).mockResolvedValue('content');

      const payload = buildPayload({
        definition: {
          ...buildPayload().definition,
          prompt: '{subject_name}',
        },
        subjectFiles: [
          { originalName: 'a.pdf', storagePath: '/uploads/a.pdf', assetId: 'asset-a' },
          { originalName: 'b.docx', storagePath: '/uploads/b.docx', assetId: 'asset-b' },
          { originalName: 'c.txt', storagePath: '/uploads/c.txt', assetId: 'asset-c' },
        ],
      });

      const result = await service.assemble(payload);

      expect(result.prompt).toBe('a.pdf, b.docx, c.txt');
    });

    // [4.3-UNIT-062] Single subjectFile (fan-out individual) still works
    it('should handle single subjectFile (fan-out individual job)', async () => {
      txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
        findOne: jest.fn().mockResolvedValue({ storagePath: '/uploads/doc.txt', mimeType: 'text/plain' }),
      }));

      (fs.readFile as jest.Mock).mockResolvedValue('Single file content');

      const payload = buildPayload({
        definition: {
          ...buildPayload().definition,
          prompt: 'Process: {subject_content} ({subject_name})',
        },
        subjectFile: { originalName: 'single.txt', storagePath: '/uploads/doc.txt', assetId: 'asset-1' },
      });

      const result = await service.assemble(payload);

      expect(result.prompt).toBe('Process: Single file content (single.txt)');
    });

    // [4.3-UNIT-063] subjectFiles takes precedence over subjectFile
    it('should use subjectFiles (batch) over subjectFile when both present', async () => {
      txManager.run.mockImplementation((_tenantId: string, cb: any) => cb({
        findOne: jest.fn().mockResolvedValue({ storagePath: '/uploads/f.txt', mimeType: 'text/plain' }),
      }));

      (fs.readFile as jest.Mock).mockResolvedValue('batch content');

      const payload = buildPayload({
        definition: {
          ...buildPayload().definition,
          prompt: '{subject_name}',
        },
        subjectFile: { originalName: 'single.txt', storagePath: '/uploads/single.txt' },
        subjectFiles: [
          { originalName: 'batch-a.txt', storagePath: '/uploads/a.txt', assetId: 'asset-a' },
          { originalName: 'batch-b.txt', storagePath: '/uploads/b.txt', assetId: 'asset-b' },
        ],
      });

      const result = await service.assemble(payload);

      // subjectFiles (batch) should win
      expect(result.prompt).toBe('batch-a.txt, batch-b.txt');
    });

    // [4.3-UNIT-064] No subject files → subject_content and subject_name are unresolved
    it('should produce unresolved warnings when no subject file/files provided', async () => {
      const payload = buildPayload({
        definition: {
          ...buildPayload().definition,
          prompt: 'Content: {subject_content}',
        },
      });

      const result = await service.assemble(payload);

      expect(result.warnings).toContain('Unresolved variable: {subject_content}');
      expect(result.prompt).toBe('Content: ');
    });
  });
});
