import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  TransactionManager,
  AssetEntity,
} from '@project-bubble/db-layer';
import {
  WorkflowJobPayload,
  WorkflowJobContextInput,
  WorkflowJobSubjectFile,
} from '@project-bubble/shared';
import { TextExtractorService } from '../ingestion/text-extractor.service';

const VARIABLE_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown']);

export interface PromptAssemblyResult {
  prompt: string;
  warnings: string[];
  assembledPromptLength: number;
}

/**
 * PromptAssemblyService — assembles the final prompt from template + inputs.
 *
 * Resolves file content (PDF, DOCX, TXT, MD) via TextExtractorService,
 * substitutes {variable_name} placeholders in the prompt template,
 * and returns the assembled prompt with warnings for any issues.
 */
@Injectable()
export class PromptAssemblyService {
  private readonly logger = new Logger(PromptAssemblyService.name);

  constructor(
    private readonly txManager: TransactionManager,
    private readonly textExtractor: TextExtractorService,
  ) {}

  async assemble(payload: WorkflowJobPayload): Promise<PromptAssemblyResult> {
    const warnings: string[] = [];
    const variables = new Map<string, string>();

    // 1. Resolve context inputs
    for (const [name, input] of Object.entries(payload.contextInputs)) {
      const content = await this.resolveContextInput(
        name,
        input,
        payload.tenantId,
        warnings,
      );
      variables.set(name, content);
    }

    // 2. Resolve subject file(s)
    if (payload.subjectFiles && payload.subjectFiles.length > 0) {
      // Batch mode: concatenate all subject files with separators
      const parts: string[] = [];
      const fileNames: string[] = [];

      for (const sf of payload.subjectFiles) {
        const content = await this.resolveSubjectFile(sf, payload.tenantId, warnings);
        parts.push(`\n\n--- File: ${sf.originalName} ---\n\n${content}`);
        fileNames.push(sf.originalName);
      }

      variables.set('subject_content', parts.join(''));
      variables.set('subject_name', fileNames.join(', '));
    } else if (payload.subjectFile) {
      // Single file mode (fan-out individual job or single-file run)
      const subjectContent = await this.resolveSubjectFile(
        payload.subjectFile,
        payload.tenantId,
        warnings,
      );
      variables.set('subject_content', subjectContent);
      variables.set('subject_name', payload.subjectFile.originalName);
    }

    // 3. Knowledge context
    variables.set('knowledge_context', payload.knowledgeContext || '');

    // 4. Variable substitution
    const prompt = payload.definition.prompt.replace(
      VARIABLE_REGEX,
      (_match, varName: string) => {
        if (variables.has(varName)) {
          return variables.get(varName)!;
        }
        warnings.push(`Unresolved variable: {${varName}}`);
        return '';
      },
    );

    const assembledPromptLength = prompt.length;

    this.logger.log({
      message: 'Prompt assembled',
      assembledPromptLength,
      inputCount: Object.keys(payload.contextInputs).length,
      hasSubjectFile: !!payload.subjectFile,
      batchFileCount: payload.subjectFiles?.length ?? 0,
      warningCount: warnings.length,
    });

    return { prompt, warnings, assembledPromptLength };
  }

  private async resolveContextInput(
    name: string,
    input: WorkflowJobContextInput,
    tenantId: string,
    warnings: string[],
  ): Promise<string> {
    if (input.type === 'text') {
      if (!input.content) {
        warnings.push(`Context input '${name}' is empty`);
        return '';
      }
      return input.content;
    }

    // type === 'file'
    return this.resolveFileContent(
      name,
      input.assetId,
      input.storagePath,
      tenantId,
      warnings,
    );
  }

  private async resolveFileContent(
    name: string,
    assetId: string | undefined,
    storagePath: string | undefined,
    tenantId: string,
    warnings: string[],
  ): Promise<string> {
    try {
      // If we have an assetId, look up the asset for storagePath + mimeType
      if (assetId) {
        const asset = await this.txManager.run(tenantId, async (manager) => {
          return manager.findOne(AssetEntity, { where: { id: assetId, tenantId } });
        });

        if (!asset) {
          warnings.push(`Asset not found for input '${name}' (assetId: ${assetId})`);
          return '';
        }

        return await this.extractFileText(asset.storagePath, asset.mimeType, name, warnings);
      }

      // If we have a storagePath directly, infer mimeType from extension
      if (storagePath) {
        const mimeType = this.inferMimeType(storagePath);
        return await this.extractFileText(storagePath, mimeType, name, warnings);
      }

      warnings.push(`File input '${name}' has no assetId or storagePath`);
      return '';
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to read file for input '${name}': ${msg}`);
      return '';
    }
  }

  private async resolveSubjectFile(
    subjectFile: WorkflowJobSubjectFile,
    tenantId: string,
    warnings: string[],
  ): Promise<string> {
    try {
      // If assetId is available, look up for mimeType
      if (subjectFile.assetId) {
        const asset = await this.txManager.run(tenantId, async (manager) => {
          return manager.findOne(AssetEntity, { where: { id: subjectFile.assetId, tenantId } });
        });

        if (asset) {
          return await this.extractFileText(asset.storagePath, asset.mimeType, 'subject_file', warnings);
        }

        warnings.push(`Subject file asset not found (assetId: ${subjectFile.assetId}), falling back to storagePath`);
      }

      // Fall back to storagePath with inferred mimeType
      const mimeType = this.inferMimeType(subjectFile.storagePath);
      return await this.extractFileText(subjectFile.storagePath, mimeType, 'subject_file', warnings);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to read subject file: ${msg}`);
      return '';
    }
  }

  private async extractFileText(
    filePath: string,
    mimeType: string,
    inputName: string,
    warnings: string[],
  ): Promise<string> {
    // For plain text files, read directly (faster than TextExtractorService)
    if (TEXT_MIME_TYPES.has(mimeType)) {
      const content = await fs.readFile(filePath, 'utf-8');
      if (!content.trim()) {
        warnings.push(`File for input '${inputName}' is empty`);
      }
      return content;
    }

    // Use TextExtractorService for PDF, DOCX, etc.
    const extracted = await this.textExtractor.extract(filePath, mimeType);
    if (!extracted.text.trim()) {
      warnings.push(`File for input '${inputName}' produced no text`);
    }
    return extracted.text;
  }

  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.txt':
        return 'text/plain';
      case '.md':
        return 'text/markdown';
      default:
        return 'text/plain'; // default to text/plain for unknown extensions
    }
  }
}
