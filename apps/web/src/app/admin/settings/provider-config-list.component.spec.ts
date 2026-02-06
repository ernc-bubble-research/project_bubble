import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Plus,
  AlertCircle,
  Key,
  Lock,
  LockOpen,
  Pencil,
  Loader2,
} from 'lucide-angular';
import { ProviderConfigListComponent } from './provider-config-list.component';
import {
  LlmProviderService,
  type LlmProviderConfig,
} from '../../core/services/llm-provider.service';

const mockConfig: LlmProviderConfig = {
  id: 'config-1',
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  maskedCredentials: { apiKey: '***********3456' },
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockOpenAIConfig: LlmProviderConfig = {
  id: 'config-2',
  providerKey: 'openai',
  displayName: 'OpenAI',
  maskedCredentials: null,
  isActive: true,
  createdAt: new Date('2026-01-02'),
  updatedAt: new Date('2026-01-02'),
};

describe('ProviderConfigListComponent [P1]', () => {
  let mockProviderService: {
    getAllConfigs: jest.Mock;
    updateConfig: jest.Mock;
  };

  beforeEach(async () => {
    mockProviderService = {
      getAllConfigs: jest.fn().mockReturnValue(of([mockConfig, mockOpenAIConfig])),
      updateConfig: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProviderConfigListComponent],
      providers: [
        { provide: LlmProviderService, useValue: mockProviderService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Plus,
            AlertCircle,
            Key,
            Lock,
            LockOpen,
            Pencil,
            Loader2,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-4-UNIT-041] [P1] should create the component', () => {
    // Given / When
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // Then
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[3.1-4-UNIT-042] [P1] should render the provider config list container', () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="provider-config-list"]')).toBeTruthy();
  });

  it('[3.1-4-UNIT-043] [P0] should load configs on construction', async () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    expect(mockProviderService.getAllConfigs).toHaveBeenCalled();
    expect(fixture.componentInstance.configs()).toHaveLength(2);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('[3.1-4-UNIT-044] [P1] should show loading state while fetching', () => {
    // Given
    const subject = new Subject<LlmProviderConfig[]>();
    mockProviderService.getAllConfigs.mockReturnValue(subject.asObservable());
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    // Then
    expect(fixture.componentInstance.loading()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="loading-skeleton"]')).toBeTruthy();
    // Cleanup
    subject.next([]);
    subject.complete();
  });

  it('[3.1-4-UNIT-045] [P1] should show empty state when no configs', async () => {
    // Given
    mockProviderService.getAllConfigs.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    expect(fixture.componentInstance.isEmpty()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="empty-state"]')).toBeTruthy();
  });

  it('[3.1-4-UNIT-046] [P1] should show error banner on load failure', async () => {
    // Given
    mockProviderService.getAllConfigs.mockReturnValue(
      throwError(() => new Error('Network error')),
    );
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    expect(fixture.componentInstance.error()).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-banner"]')).toBeTruthy();
  });

  it('[3.1-4-UNIT-047] [P1] should render config rows in table', async () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="configs-table"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="provider-row-config-1"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="provider-row-config-2"]')).toBeTruthy();
  });

  it('[3.1-4-UNIT-048] [P1] should emit addConfigClicked when Add Provider button clicked', async () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.addConfigClicked.subscribe(spy);
    // When
    const addBtn = fixture.nativeElement.querySelector('[data-testid="add-provider-btn"]');
    addBtn.click();
    // Then
    expect(spy).toHaveBeenCalled();
  });

  it('[3.1-4-UNIT-049] [P1] should emit editConfigClicked when edit button clicked', async () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.editConfigClicked.subscribe(spy);
    // When
    const editBtn = fixture.nativeElement.querySelector('[data-testid="edit-config-1"]');
    editBtn.click();
    // Then
    expect(spy).toHaveBeenCalledWith(mockConfig);
  });

  it('[3.1-4-UNIT-050] [P1] should toggle active status', async () => {
    // Given
    const updatedConfig = { ...mockConfig, isActive: false };
    mockProviderService.updateConfig.mockReturnValue(of(updatedConfig));
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    fixture.componentInstance.onToggleActive(mockConfig);
    await fixture.whenStable();
    // Then
    expect(mockProviderService.updateConfig).toHaveBeenCalledWith('config-1', {
      isActive: false,
    });
  });

  it('[3.1-4-UNIT-051] [P2] should display credential summary correctly', () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    const component = fixture.componentInstance;
    // When / Then
    expect(component.getCredentialSummary({ apiKey: '***3456' })).toBe(
      '1 field(s) configured',
    );
    expect(component.getCredentialSummary(null)).toBe('No credentials');
    expect(
      component.getCredentialSummary({ _status: 'encrypted (key not available)' }),
    ).toBe('encrypted (key not available)');
  });

  it('[3.1-4-UNIT-052] [P2] should return display name for known providers', () => {
    // Given
    const fixture = TestBed.createComponent(ProviderConfigListComponent);
    const component = fixture.componentInstance;
    // When / Then
    expect(component.getProviderDisplayName('google-ai-studio')).toBe(
      'Google AI Studio',
    );
    expect(component.getProviderDisplayName('openai')).toBe('OpenAI');
    expect(component.getProviderDisplayName('unknown')).toBe('unknown');
  });
});
