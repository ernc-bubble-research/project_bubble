import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import type { ProviderTypeDto } from '@project-bubble/shared';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
  AlertCircle,
  Loader2,
  Key,
  Info,
} from 'lucide-angular';
import { ProviderConfigFormDialogComponent } from './provider-config-form-dialog.component';
import {
  LlmProviderService,
  type LlmProviderConfig,
} from '../../core/services/llm-provider.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

const mockConfig: LlmProviderConfig = {
  id: 'config-1',
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  maskedCredentials: { apiKey: '***********3456' },
  isActive: true,
  rateLimitRpm: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

@Component({
  standalone: true,
  imports: [ProviderConfigFormDialogComponent],
  template: `
    <app-provider-config-form-dialog
      [config]="config()"
      (saved)="onSaved($event)"
      (cancelled)="onCancelled()"
    ></app-provider-config-form-dialog>
  `,
})
class TestHostComponent {
  config = signal<LlmProviderConfig | null>(null);
  savedConfig: LlmProviderConfig | null = null;
  cancelled = false;

  onSaved(config: LlmProviderConfig): void {
    this.savedConfig = config;
  }

  onCancelled(): void {
    this.cancelled = true;
  }
}

describe('ProviderConfigFormDialogComponent [P1]', () => {
  let mockProviderService: {
    createConfig: jest.Mock;
    updateConfig: jest.Mock;
    getAllConfigs: jest.Mock;
  };

  beforeEach(async () => {
    mockProviderService = {
      createConfig: jest.fn().mockReturnValue(of(mockConfig)),
      updateConfig: jest.fn().mockReturnValue(of(mockConfig)),
      getAllConfigs: jest.fn().mockReturnValue(of([])),
    };

    const mockProviderTypeService = {
      types: signal([
        {
          providerKey: 'google-ai-studio',
          displayName: 'Google AI Studio',
          credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
          isDevelopmentOnly: false,
        },
        {
          providerKey: 'mock',
          displayName: 'Mock Provider',
          credentialFields: [],
          isDevelopmentOnly: true,
        },
        {
          providerKey: 'vertex',
          displayName: 'Vertex AI',
          credentialFields: [
            { key: 'projectId', label: 'Project ID', type: 'text', required: true },
            { key: 'location', label: 'Location', type: 'text', required: true },
          ],
          isDevelopmentOnly: false,
        },
        {
          providerKey: 'openai',
          displayName: 'OpenAI',
          credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
          isDevelopmentOnly: false,
        },
      ]),
      getProviderTypes: jest.fn().mockReturnValue(of([])),
      getDisplayName: jest.fn((key: string) => {
        const names: Record<string, string> = {
          'google-ai-studio': 'Google AI Studio',
          mock: 'Mock Provider',
          vertex: 'Vertex AI',
          openai: 'OpenAI',
        };
        return names[key] ?? key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: LlmProviderService, useValue: mockProviderService },
        { provide: ProviderTypeService, useValue: mockProviderTypeService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            X,
            AlertCircle,
            Loader2,
            Key,
            Info,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-4-UNIT-053] [P1] should create in add mode when config is null', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Add Provider');
  });

  it('[3.1-4-UNIT-054] [P1] should create in edit mode when config is provided', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.config.set(mockConfig);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Edit Provider');
  });

  it('[3.1-4-UNIT-055] [P1] should disable providerKey in edit mode', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.config.set(mockConfig);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const providerInput = fixture.nativeElement.querySelector(
      '[data-testid="input-providerKey"]',
    ) as HTMLInputElement;
    expect(providerInput.readOnly || providerInput.disabled).toBe(true);
  });

  it('[3.1-4-UNIT-056] [P1] should emit cancelled event when cancel button clicked', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    const cancelBtn = fixture.nativeElement.querySelector(
      '[data-testid="cancel-btn"]',
    );
    cancelBtn.click();
    // Then
    expect(fixture.componentInstance.cancelled).toBe(true);
  });

  it('[3.1-4-UNIT-057] [P0] should call createConfig on submit in add mode', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });
    dialogComponent.selectedProviderKey.set('google-ai-studio');

    // When
    dialogComponent.onSubmit();
    await fixture.whenStable();

    // Then
    expect(mockProviderService.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
      }),
    );
  });

  it('[3.1-4-UNIT-058] [P0] should call updateConfig on submit in edit mode', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.config.set(mockConfig);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;
    dialogComponent.form.patchValue({
      displayName: 'Updated Name',
    });

    // When
    dialogComponent.onSubmit();
    await fixture.whenStable();

    // Then
    expect(mockProviderService.updateConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        displayName: 'Updated Name',
      }),
    );
  });

  it('[3.1-4-UNIT-059] [P1] should display error on 409 conflict', async () => {
    // Given
    mockProviderService.createConfig.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });

    // When
    dialogComponent.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    // Then
    expect(dialogComponent.error()).toContain('already exists');
  });

  it('[3.1-4-UNIT-060] [P1] should display server error message on 400', async () => {
    // Given
    mockProviderService.createConfig.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Missing required credential fields' },
          }),
      ),
    );
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });

    // When
    dialogComponent.onSubmit();
    await fixture.whenStable();
    fixture.detectChanges();

    // Then
    expect(dialogComponent.error()).toBe(
      'Missing required credential fields',
    );
  });

  it('[3.1-4-UNIT-061] [P1] should show credential fields for google-ai-studio provider', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;

    // When
    dialogComponent.form.patchValue({ providerKey: 'google-ai-studio' });
    dialogComponent.selectedProviderKey.set('google-ai-studio');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="input-cred-apiKey"]')).toBeTruthy();
  });

  it('[3.1-4-UNIT-062] [P1] should show info banner for mock provider', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;

    // When
    dialogComponent.form.patchValue({ providerKey: 'mock' });
    dialogComponent.selectedProviderKey.set('mock');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('no credentials');
  });

  it('[3.1-4-UNIT-063] [P2] should not submit when form is invalid', async () => {
    // Given
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0]
      .componentInstance as ProviderConfigFormDialogComponent;
    // Form has empty required fields

    // When
    dialogComponent.onSubmit();
    await fixture.whenStable();

    // Then
    expect(mockProviderService.createConfig).not.toHaveBeenCalled();
  });
});
