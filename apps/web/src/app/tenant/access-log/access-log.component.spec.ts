import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LucideAngularModule, Shield, Loader2 } from 'lucide-angular';
import { AccessLogComponent } from './access-log.component';
import type { AccessLogEntryDto } from '@project-bubble/shared';

describe('AccessLogComponent [P1]', () => {
  let fixture: ComponentFixture<AccessLogComponent>;
  let component: AccessLogComponent;
  let httpMock: HttpTestingController;

  const mockEntries: AccessLogEntryDto[] = [
    {
      id: 'session-1',
      startedAt: '2026-02-14T10:00:00.000Z',
      endedAt: '2026-02-14T10:15:00.000Z',
      actionCount: 3,
      status: 'completed',
    },
    {
      id: 'session-2',
      startedAt: '2026-02-13T09:00:00.000Z',
      endedAt: null,
      actionCount: 0,
      status: 'active',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessLogComponent, LucideAngularModule.pick({ Shield, Loader2 })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccessLogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
    fixture.destroy();
  });

  it('[4-SAB-UNIT-009] should show loading spinner initially', () => {
    expect(component.loading()).toBe(true);

    // Flush the pending request to avoid verify error
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush([]);
  });

  it('[4-SAB-UNIT-010] should render table rows with entries', async () => {
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush(mockEntries);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.entries()).toHaveLength(2);
  });

  it('[4-SAB-UNIT-011] should show empty state when no sessions', async () => {
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush([]);

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.entries()).toEqual([]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
  });

  it('[4-SAB-UNIT-012] should show "Active" badge for null endedAt', async () => {
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush([mockEntries[1]]); // active session

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('.badge-active');
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.trim()).toBe('Active');
  });

  it('[4-SAB-UNIT-013] should show "Completed" badge for ended sessions', async () => {
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush([mockEntries[0]]); // completed session

    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('.badge-completed');
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.trim()).toBe('Completed');
  });

  it('[4-SAB-UNIT-014] should format duration correctly', () => {
    // Flush the initial HTTP request from constructor
    const req = httpMock.expectOne('/api/app/access-log');
    req.flush([]);

    expect(component.formatDuration(
      '2026-02-14T10:00:00.000Z',
      '2026-02-14T10:15:00.000Z',
    )).toBe('15 min');

    expect(component.formatDuration(
      '2026-02-14T10:00:00.000Z',
      '2026-02-14T11:30:00.000Z',
    )).toBe('1 hr 30 min');

    expect(component.formatDuration(
      '2026-02-14T10:00:00.000Z',
      null,
    )).toBe('—');
  });

  it('[4-SAB-UNIT-015] should show error state on HTTP failure', async () => {
    const req = httpMock.expectOne('/api/app/access-log');
    req.error(new ProgressEvent('error'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(true);
    expect(component.entries()).toEqual([]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="access-log-error"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="access-log-empty"]')).toBeFalsy();
  });
});
