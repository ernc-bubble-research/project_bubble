import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LlmModelService, type LlmModel } from './llm-model.service';
import type { CreateLlmModelDto, UpdateLlmModelDto, BulkUpdateModelStatusDto } from '@project-bubble/shared';

const mockModel: LlmModel = {
  id: 'model-1',
  providerKey: 'google-ai-studio',
  modelId: 'models/gemini-2.0-flash',
  displayName: 'Gemini 2.0 Flash',
  contextWindow: 1000000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: '0.000150',
  costPer1kOutput: '0.000600',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LlmModelService [P2]', () => {
  let service: LlmModelService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(LlmModelService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getActiveModels', () => {
    it('[3.1-3-UNIT-001] should GET /api/app/llm-models', () => {
      const models = [mockModel];

      service.getActiveModels().subscribe((result) => {
        expect(result).toEqual(models);
      });

      const req = httpMock.expectOne('/api/app/llm-models');
      expect(req.request.method).toBe('GET');
      req.flush(models);
    });
  });

  describe('getAllModels', () => {
    it('[3.1-3-UNIT-002] should GET /api/admin/llm-models', () => {
      const models = [mockModel, { ...mockModel, id: 'model-2', isActive: false }];

      service.getAllModels().subscribe((result) => {
        expect(result).toEqual(models);
      });

      const req = httpMock.expectOne('/api/admin/llm-models');
      expect(req.request.method).toBe('GET');
      req.flush(models);
    });
  });

  describe('createModel', () => {
    it('[3.1-3-UNIT-003] should POST /api/admin/llm-models with DTO', () => {
      const createDto: CreateLlmModelDto = {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        isActive: true,
      };

      service.createModel(createDto).subscribe((result) => {
        expect(result).toEqual(mockModel);
      });

      const req = httpMock.expectOne('/api/admin/llm-models');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createDto);
      req.flush(mockModel);
    });
  });

  describe('updateModel', () => {
    it('[3.1-3-UNIT-004] should PATCH /api/admin/llm-models/:id with DTO', () => {
      const updateDto: UpdateLlmModelDto = {
        displayName: 'Updated Name',
        isActive: false,
      };

      service.updateModel('model-1', updateDto).subscribe((result) => {
        expect(result.displayName).toBe('Updated Name');
      });

      const req = httpMock.expectOne('/api/admin/llm-models/model-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateDto);
      req.flush({ ...mockModel, ...updateDto });
    });
  });

  describe('bulkUpdateStatus', () => {
    it('[4-FIX-B-UNIT-011] should PATCH /api/admin/llm-models/bulk-status with DTO', () => {
      const dto: BulkUpdateModelStatusDto = {
        providerKey: 'google-ai-studio',
        isActive: false,
      };

      service.bulkUpdateStatus(dto).subscribe((result) => {
        expect(result).toEqual({ affected: 2 });
      });

      const req = httpMock.expectOne('/api/admin/llm-models/bulk-status');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush({ affected: 2 });
    });
  });
});
