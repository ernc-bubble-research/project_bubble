import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FileCardComponent } from './file-card.component';
import { AssetResponseDto } from '@project-bubble/shared';

const baseAsset: AssetResponseDto = {
  id: 'a1',
  tenantId: 't1',
  folderId: null,
  originalName: 'report.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
  sha256Hash: 'a'.repeat(64),
  isIndexed: false,
  status: 'active',
  archivedAt: null,
  uploadedBy: 'u1',
  createdAt: new Date('2026-01-30'),
  updatedAt: new Date('2026-01-30'),
} as AssetResponseDto;

describe('FileCardComponent [2.2-UNIT-008] [P2]', () => {
  let component: FileCardComponent;
  let fixture: ComponentFixture<FileCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileCardComponent],
    })
      .overrideComponent(FileCardComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FileCardComponent);
    component = fixture.componentInstance;
  });

  it('[2.2-UNIT-008a] should create the component', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('[2.2-UNIT-008b] should show brain icon for indexed files', () => {
    const indexedAsset = { ...baseAsset, isIndexed: true };
    fixture.componentRef.setInput('asset', indexedAsset);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const brainBadge = el.querySelector('.badge-indexed');
    expect(brainBadge).toBeTruthy();
  });

  it('[2.2-UNIT-008c] should NOT show brain icon for non-indexed files', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const brainBadge = el.querySelector('.badge-indexed');
    expect(brainBadge).toBeNull();
  });

  it('[2.2-UNIT-008d] should show spinner when indexing is in progress', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.componentRef.setInput('indexing', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const spinner = el.querySelector('.badge-indexing');
    expect(spinner).toBeTruthy();
  });

  it('[2.2-UNIT-008e] should format file size correctly', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();

    expect(component.formatSize(500)).toBe('500 B');
    expect(component.formatSize(1024)).toBe('1.0 KB');
    expect(component.formatSize(1536)).toBe('1.5 KB');
    expect(component.formatSize(1048576)).toBe('1.0 MB');
  });

  it('[2.2-UNIT-008f] should return correct file extension', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();

    expect(component.getExtension()).toBe('PDF');
  });

  it('[2.2-UNIT-008g] should return correct icon for PDF', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();

    expect(component.getIcon()).toBe('file-text');
  });

  it('[2.2-UNIT-008h] should display info tooltip with Knowledge Base explanation', () => {
    fixture.componentRef.setInput('asset', baseAsset);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const learnBtn = el.querySelector('.btn-learn') as HTMLElement;
    const infoIcon = el.querySelector('.info-tooltip') as HTMLElement;
    const expectedText = "Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows.";

    expect(learnBtn).toBeTruthy();
    expect(learnBtn.getAttribute('title')).toBe(expectedText);
    expect(infoIcon).toBeTruthy();
    expect(infoIcon.getAttribute('title')).toBe(expectedText);
  });
});
