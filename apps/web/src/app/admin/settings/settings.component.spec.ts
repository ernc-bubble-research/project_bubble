import { TestBed } from '@angular/core/testing';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Settings,
  Brain,
} from 'lucide-angular';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent [P2]', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Settings, Brain }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-1-UNIT-001] should create', () => {
    // Given — default TestBed setup
    // When
    const fixture = TestBed.createComponent(SettingsComponent);
    // Then
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[3.1-1-UNIT-002] should render settings page with data-testid', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="settings-page"]')).toBeTruthy();
  });

  it('[3.1-1-UNIT-003] should render page title with settings icon', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.page-title h1');
    expect(title?.textContent?.trim()).toBe('Settings');
    const icon = compiled.querySelector('.page-title lucide-icon');
    expect(icon).toBeTruthy();
  });

  it('[3.1-1-UNIT-004] should render tab bar with two tabs', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it('[3.1-1-UNIT-005] should have LLM Models tab active by default', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const llmTab = compiled.querySelector('[data-testid="tab-llm-models"]');
    expect(llmTab?.classList.contains('active')).toBe(true);
    expect(llmTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('[3.1-1-UNIT-006] should show placeholder content in LLM Models tab', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const placeholder = compiled.querySelector('[data-testid="llm-models-placeholder"]');
    expect(placeholder).toBeTruthy();
    expect(placeholder?.textContent).toContain('LLM model management');
  });

  it('[3.1-1-UNIT-007] should have System tab disabled', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const systemTab = compiled.querySelector('[data-testid="tab-system"]') as HTMLButtonElement;
    expect(systemTab.disabled).toBe(true);
    expect(systemTab.classList.contains('disabled')).toBe(true);
    expect(systemTab.getAttribute('aria-disabled')).toBe('true');
  });

  it('[3.1-1-UNIT-008] should show Coming soon badge on System tab', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('[data-testid="tab-system"] .coming-soon-badge');
    expect(badge?.textContent?.trim()).toBe('Coming soon');
  });

  it('[3.1-1-UNIT-009] should not change tab when System tab is clicked', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    expect(component.activeTab()).toBe('llm-models');
    // When
    component.setTab('system');
    // Then
    expect(component.activeTab()).toBe('llm-models');
  });

  it('[3.1-1-UNIT-010] should have proper ARIA tab panel attributes', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const tab = compiled.querySelector('#tab-llm-models');
    expect(tab?.getAttribute('aria-controls')).toBe('tabpanel-llm-models');
    const panel = compiled.querySelector('#tabpanel-llm-models');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe('tab-llm-models');
  });
});
