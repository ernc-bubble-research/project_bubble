import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LlmModelEntity } from '@project-bubble/db-layer';
import { AffectedWorkflowDto, DeactivateModelResponseDto } from '@project-bubble/shared';

@Injectable()
export class ModelReassignmentService {
  constructor(
    @InjectRepository(LlmModelEntity)
    private readonly modelRepo: Repository<LlmModelEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Find all workflow versions that reference any of the given model IDs
   * in their definition.execution.model JSONB path.
   */
  async findAffectedVersions(modelIds: string[]): Promise<AffectedWorkflowDto[]> {
    if (modelIds.length === 0) return [];

    // JSONB path query across workflow_versions joined to workflow_templates
    // Soft-delete filter on templates: WHERE wt.deleted_at IS NULL
    const rows: Array<{
      version_id: string;
      template_id: string;
      template_name: string;
      version_number: number;
      template_status: string;
    }> = await this.dataSource.query(
      `SELECT
         wv.id AS version_id,
         wv.template_id,
         wt.name AS template_name,
         wv.version_number,
         wt.status AS template_status
       FROM workflow_versions wv
       JOIN workflow_templates wt ON wv.template_id = wt.id
       WHERE wt.deleted_at IS NULL
         AND wv.definition->'execution'->>'model' = ANY($1)
       ORDER BY wt.name ASC, wv.version_number DESC`,
      [modelIds],
    );

    return rows.map((r) => {
      const dto = new AffectedWorkflowDto();
      dto.versionId = r.version_id;
      dto.templateId = r.template_id;
      dto.templateName = r.template_name;
      dto.versionNumber = r.version_number;
      dto.templateStatus = r.template_status;
      return dto;
    });
  }

  /**
   * Atomically: snapshot N-1 config, reassign affected versions to replacement model,
   * nuclear reset generation params, deactivate the original model.
   *
   * Uses SET LOCAL app.is_admin = 'true' to bypass RLS on workflow_versions
   * (this is an admin-only endpoint).
   */
  async reassignAndDeactivate(
    modelId: string,
    replacementModelId: string,
  ): Promise<DeactivateModelResponseDto> {
    // Quick sanity check before entering transaction
    if (modelId === replacementModelId) {
      throw new BadRequestException(
        'Replacement model must be different from the model being deactivated',
      );
    }

    // All validation + mutation inside a single transaction to prevent TOCTOU race conditions.
    // SELECT ... FOR UPDATE locks the model rows for the duration of the transaction.
    return this.dataSource.transaction(async (manager) => {
      // Set admin bypass for RLS on workflow_versions
      await manager.query(`SET LOCAL app.is_admin = 'true'`);

      // Lock and validate the model being deactivated (raw SQL returns snake_case)
      const modelRows: Array<{ id: string; is_active: boolean }> = await manager.query(
        `SELECT id, is_active FROM llm_models WHERE id = $1 FOR UPDATE`,
        [modelId],
      );
      if (modelRows.length === 0) {
        throw new NotFoundException(`Model "${modelId}" not found`);
      }
      if (!modelRows[0].is_active) {
        throw new BadRequestException(`Model "${modelId}" is already inactive`);
      }

      // Lock and validate the replacement model
      const replacementRows: Array<{ id: string; is_active: boolean }> = await manager.query(
        `SELECT id, is_active FROM llm_models WHERE id = $1 FOR UPDATE`,
        [replacementModelId],
      );
      if (replacementRows.length === 0) {
        throw new NotFoundException(
          `Replacement model "${replacementModelId}" not found`,
        );
      }
      if (!replacementRows[0].is_active) {
        throw new BadRequestException(
          `Replacement model "${replacementModelId}" is not active`,
        );
      }

      // Guard: cannot deactivate the last active model
      const countResult: Array<{ count: string }> = await manager.query(
        `SELECT COUNT(*) as count FROM llm_models WHERE is_active = true`,
      );
      const activeCount = parseInt(countResult[0]?.count ?? '0', 10);
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Cannot deactivate the last active model. At least one active model must remain.',
        );
      }

      // Step 1: Snapshot N-1 (previous generation config)
      // Captures modelId + all generation param overrides from the execution section
      await manager.query(
        `UPDATE workflow_versions
         SET previous_generation_config = jsonb_build_object(
           'modelId', definition->'execution'->>'model',
           'temperature', definition->'execution'->'temperature',
           'max_output_tokens', definition->'execution'->'max_output_tokens',
           'top_p', definition->'execution'->'top_p',
           'top_k', definition->'execution'->'top_k',
           'stop_sequences', definition->'execution'->'stop_sequences'
         )
         WHERE definition->'execution'->>'model' = $1`,
        [modelId],
      );

      // Step 2: Replace model UUID + nuclear reset (clear all generation param overrides)
      // Chain jsonb path removals then set the new model
      const result = await manager.query(
        `UPDATE workflow_versions
         SET definition = jsonb_set(
           definition #- '{execution,temperature}'
                      #- '{execution,max_output_tokens}'
                      #- '{execution,top_p}'
                      #- '{execution,top_k}'
                      #- '{execution,stop_sequences}',
           '{execution,model}',
           to_jsonb($2::text)
         )
         WHERE definition->'execution'->>'model' = $1`,
        [modelId, replacementModelId],
      );

      // pg driver returns [rows, affectedCount] for UPDATE without RETURNING
      const versionsReassigned = result?.[1] ?? 0;

      // Step 3: Deactivate the original model
      await manager.query(
        `UPDATE llm_models SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [modelId],
      );

      const response = new DeactivateModelResponseDto();
      response.versionsReassigned = versionsReassigned;
      response.deactivatedModelId = modelId;
      response.replacementModelId = replacementModelId;
      return response;
    });
  }

  /**
   * Atomically reassign and deactivate multiple models in a single transaction.
   * Used for provider deactivation cascade — if any model fails, all changes roll back.
   */
  async reassignMultipleAndDeactivate(
    modelIds: string[],
    replacementModelId: string,
    providerConfigId?: string,
  ): Promise<DeactivateModelResponseDto[]> {
    if (modelIds.length === 0) return [];

    for (const modelId of modelIds) {
      if (modelId === replacementModelId) {
        throw new BadRequestException(
          'Replacement model must be different from the models being deactivated',
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL app.is_admin = 'true'`);

      // Lock and validate replacement model once
      const replacementRows: Array<{ id: string; is_active: boolean }> = await manager.query(
        `SELECT id, is_active FROM llm_models WHERE id = $1 FOR UPDATE`,
        [replacementModelId],
      );
      if (replacementRows.length === 0) {
        throw new NotFoundException(`Replacement model "${replacementModelId}" not found`);
      }
      if (!replacementRows[0].is_active) {
        throw new BadRequestException(`Replacement model "${replacementModelId}" is not active`);
      }

      // Guard: cannot deactivate if it would leave zero active models
      const countResult: Array<{ count: string }> = await manager.query(
        `SELECT COUNT(*) as count FROM llm_models WHERE is_active = true`,
      );
      const activeCount = parseInt(countResult[0]?.count ?? '0', 10);
      if (activeCount <= modelIds.length) {
        throw new BadRequestException(
          'Cannot deactivate: would leave zero active models. At least one active model must remain.',
        );
      }

      const results: DeactivateModelResponseDto[] = [];

      for (const modelId of modelIds) {
        // Lock and validate each model
        const modelRows: Array<{ id: string; is_active: boolean }> = await manager.query(
          `SELECT id, is_active FROM llm_models WHERE id = $1 FOR UPDATE`,
          [modelId],
        );
        if (modelRows.length === 0) continue; // skip if already deleted
        if (!modelRows[0].is_active) continue; // skip if already inactive

        // Snapshot N-1
        await manager.query(
          `UPDATE workflow_versions
           SET previous_generation_config = jsonb_build_object(
             'modelId', definition->'execution'->>'model',
             'temperature', definition->'execution'->'temperature',
             'max_output_tokens', definition->'execution'->'max_output_tokens',
             'top_p', definition->'execution'->'top_p',
             'top_k', definition->'execution'->'top_k',
             'stop_sequences', definition->'execution'->'stop_sequences'
           )
           WHERE definition->'execution'->>'model' = $1`,
          [modelId],
        );

        // Replace model + nuclear reset
        const result = await manager.query(
          `UPDATE workflow_versions
           SET definition = jsonb_set(
             definition #- '{execution,temperature}'
                        #- '{execution,max_output_tokens}'
                        #- '{execution,top_p}'
                        #- '{execution,top_k}'
                        #- '{execution,stop_sequences}',
             '{execution,model}',
             to_jsonb($2::text)
           )
           WHERE definition->'execution'->>'model' = $1`,
          [modelId, replacementModelId],
        );

        const versionsReassigned = result?.[1] ?? 0;

        // Deactivate the model
        await manager.query(
          `UPDATE llm_models SET is_active = false, updated_at = NOW() WHERE id = $1`,
          [modelId],
        );

        const response = new DeactivateModelResponseDto();
        response.versionsReassigned = versionsReassigned;
        response.deactivatedModelId = modelId;
        response.replacementModelId = replacementModelId;
        results.push(response);
      }

      // If provider config ID provided, deactivate it atomically within same transaction
      if (providerConfigId) {
        await manager.query(
          `UPDATE llm_provider_configs SET is_active = false, updated_at = NOW() WHERE id = $1`,
          [providerConfigId],
        );
      }

      return results;
    });
  }

  /**
   * Get the count of active models, optionally excluding specific model IDs.
   * Used by the frontend to determine if deactivation should be allowed.
   */
  async getActiveModelCount(excludeIds: string[] = []): Promise<number> {
    if (excludeIds.length === 0) {
      return this.modelRepo.count({ where: { isActive: true } });
    }

    const count: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM llm_models WHERE is_active = true AND id != ALL($1)`,
      [excludeIds],
    );
    return parseInt(count[0]?.count ?? '0', 10);
  }
}
