import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import type { ProviderTypeDto } from '@project-bubble/shared';
import { ProviderTypeService } from './provider-type.service';

const mockTypes: ProviderTypeDto[] = [
  {
    providerKey: 'google-ai-studio',
    displayName: 'Google AI Studio',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
    isDevelopmentOnly: false,
  },
  {
    providerKey: 'mock',
    displayName: 'Mock Provider',
    credentialFields: [],
    isDevelopmentOnly: true,
  },
];

describe('ProviderTypeService [P1]', () => {
  let service: ProviderTypeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProviderTypeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('[4-PR-UNIT-PTS01] should fetch provider types and populate types signal', () => {
    // When
    service.getProviderTypes().subscribe((result) => {
      // Then
      expect(result).toEqual(mockTypes);
    });

    const req = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockTypes);

    expect(service.types()).toEqual(mockTypes);
  });

  it('[4-PR-UNIT-PTS02] should cache the result — second call does not make new HTTP request', () => {
    // When — first call
    service.getProviderTypes().subscribe();
    const req = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    req.flush(mockTypes);

    // When — second call
    service.getProviderTypes().subscribe((result) => {
      expect(result).toEqual(mockTypes);
    });

    // Then — no second HTTP request
    httpTesting.expectNone('/api/admin/settings/llm-providers/types');
  });

  it('[4-PR-UNIT-PTS03] should clear cache on error so next call retries', () => {
    // When — first call fails
    service.getProviderTypes().subscribe((result) => {
      expect(result).toEqual([]); // catchError returns empty array
    });

    const req1 = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    // retry(2) means 3 total attempts before catchError
    req1.flush(null, { status: 500, statusText: 'Server Error' });
    const retry1 = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    retry1.flush(null, { status: 500, statusText: 'Server Error' });
    const retry2 = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    retry2.flush(null, { status: 500, statusText: 'Server Error' });

    // When — second call should make a new request (cache was cleared)
    service.getProviderTypes().subscribe((result) => {
      expect(result).toEqual(mockTypes);
    });

    const req2 = httpTesting.expectOne(
      '/api/admin/settings/llm-providers/types',
    );
    req2.flush(mockTypes);

    expect(service.types()).toEqual(mockTypes);
  });

  it('[4-PR-UNIT-PTS04] should return display name for known provider key', () => {
    // Given — populate types signal
    service.getProviderTypes().subscribe();
    httpTesting
      .expectOne('/api/admin/settings/llm-providers/types')
      .flush(mockTypes);

    // When / Then
    expect(service.getDisplayName('google-ai-studio')).toBe(
      'Google AI Studio',
    );
    expect(service.getDisplayName('mock')).toBe('Mock Provider');
  });

  it('[4-PR-UNIT-PTS05] should return providerKey as fallback for unknown key', () => {
    // Given — types signal is empty (no load yet)
    // When / Then
    expect(service.getDisplayName('unknown-provider')).toBe(
      'unknown-provider',
    );
  });
});
