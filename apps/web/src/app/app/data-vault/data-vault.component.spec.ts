import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, NEVER } from 'rxjs';
import { DataVaultComponent } from './data-vault.component';
import { AssetService } from '../../core/services/asset.service';
import { AssetResponseDto } from '@project-bubble/shared';

const mockAssets: AssetResponseDto[] = [
  {
    id: 'a1',
    tenantId: 't1',
    folderId: null,
    originalName: 'codebook-alpha.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    sha256Hash: 'a'.repeat(64),
    isIndexed: false,
    status: 'active',
    archivedAt: null,
    uploadedBy: 'u1',
    createdAt: new Date('2026-01-30'),
    updatedAt: new Date('2026-01-30'),
  } as AssetResponseDto,
  {
    id: 'a2',
    tenantId: 't1',
    folderId: null,
    originalName: 'transcript-beta.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 2048,
    sha256Hash: 'b'.repeat(64),
    isIndexed: false,
    status: 'active',
    archivedAt: null,
    uploadedBy: 'u1',
    createdAt: new Date('2026-01-29'),
    updatedAt: new Date('2026-01-29'),
  } as AssetResponseDto,
  {
    id: 'a3',
    tenantId: 't1',
    folderId: null,
    originalName: 'knowledge-gamma.txt',
    mimeType: 'text/plain',
    fileSize: 512,
    sha256Hash: 'c'.repeat(64),
    isIndexed: false,
    status: 'active',
    archivedAt: null,
    uploadedBy: 'u1',
    createdAt: new Date('2026-01-28'),
    updatedAt: new Date('2026-01-28'),
  } as AssetResponseDto,
];

const mockAssetService = {
  findAll: jest.fn().mockReturnValue(of(mockAssets)),
  findAllFolders: jest.fn().mockReturnValue(of([])),
  upload: jest.fn(),
  archive: jest.fn().mockReturnValue(of({})),
  createFolder: jest.fn(),
  indexAsset: jest.fn().mockReturnValue(of({ jobId: 'job-1', assetId: 'a1', status: 'queued' })),
  deIndexAsset: jest.fn().mockReturnValue(of(undefined)),
};

const mockRoute = {
  paramMap: of(new Map()),
};

describe('DataVaultComponent [P2]', () => {
  let component: DataVaultComponent;
  let fixture: ComponentFixture<DataVaultComponent>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAssetService.findAll.mockReturnValue(of(mockAssets));
    mockAssetService.findAllFolders.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DataVaultComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: AssetService, useValue: mockAssetService },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    })
      .overrideComponent(DataVaultComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DataVaultComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  it('[2.1-UNIT-039] should create the component', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('[2.1-UNIT-040] should load assets on init', () => {
    fixture.detectChanges();

    expect(mockAssetService.findAll).toHaveBeenCalled();
    expect(mockAssetService.findAllFolders).toHaveBeenCalled();
    expect(component.assets()).toEqual(mockAssets);
    expect(component.loading()).toBe(false);
  });

  it('[2.1-UNIT-042] should filter by search query', () => {
    fixture.detectChanges();

    expect(component.filteredAssets().length).toBe(3);

    component.searchQuery.set('alpha');
    expect(component.filteredAssets().length).toBe(1);
    expect(component.filteredAssets()[0].originalName).toContain('alpha');

    component.searchQuery.set('BETA');
    expect(component.filteredAssets().length).toBe(1);
    expect(component.filteredAssets()[0].originalName).toContain('beta');

    component.searchQuery.set('nonexistent');
    expect(component.filteredAssets().length).toBe(0);

    component.searchQuery.set('');
    expect(component.filteredAssets().length).toBe(3);
  });

  it('[2.1-UNIT-043] should toggle view mode', () => {
    fixture.detectChanges();

    expect(component.viewMode()).toBe('grid');
    component.toggleView();
    expect(component.viewMode()).toBe('list');
    component.toggleView();
    expect(component.viewMode()).toBe('grid');
  });

  it('[2.1-UNIT-044] should toggle selection', () => {
    fixture.detectChanges();

    expect(component.selectedIds().size).toBe(0);

    component.toggleSelect('a1');
    expect(component.selectedIds().has('a1')).toBe(true);
    expect(component.selectedIds().size).toBe(1);

    component.toggleSelect('a2');
    expect(component.selectedIds().has('a2')).toBe(true);
    expect(component.selectedIds().size).toBe(2);

    component.toggleSelect('a1');
    expect(component.selectedIds().has('a1')).toBe(false);
    expect(component.selectedIds().size).toBe(1);
  });

  // [4-FIX-B-UNIT-005] Zoneless CD: filteredAssets reflects data after async load without manual trigger
  it('should populate filteredAssets computed signal immediately after async load', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Assets should be populated from the mock observable
    expect(component.assets().length).toBe(3);
    expect(component.filteredAssets().length).toBe(3);
    // loading should be false after load completes
    expect(component.loading()).toBe(false);
  });

  // [4-FIX-B-UNIT-006] Zoneless CD: folders signal reflects data after async load
  it('should populate folders signal immediately after async folder load', async () => {
    const mockFolders = [{ id: 'f1', tenantId: 't1', name: 'Docs', createdAt: new Date(), updatedAt: new Date() }];
    mockAssetService.findAllFolders.mockReturnValue(of(mockFolders));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.folders().length).toBe(1);
    expect(component.folders()[0].name).toBe('Docs');
  });

  it('[2.2-UNIT-007a] should track indexing state via indexingIds signal', () => {
    fixture.detectChanges();

    expect(component.indexingIds().size).toBe(0);

    // Use NEVER to prevent the observable from completing so we can check intermediate state
    mockAssetService.indexAsset.mockReturnValue(NEVER);
    component.onIndexAsset('a1');
    expect(component.indexingIds().has('a1')).toBe(true);

    // Restore for other tests
    mockAssetService.indexAsset.mockReturnValue(of({ jobId: 'job-1', assetId: 'a1', status: 'queued' }));
  });

  it('[2.2-UNIT-007b] should call assetService.indexAsset on Learn This action', () => {
    fixture.detectChanges();

    component.onIndexAsset('a1');

    expect(mockAssetService.indexAsset).toHaveBeenCalledWith('a1');
  });

  it('[2.2-UNIT-007c] should call assetService.deIndexAsset on de-index action', () => {
    fixture.detectChanges();

    component.onDeIndexAsset('a1');

    expect(mockAssetService.deIndexAsset).toHaveBeenCalledWith('a1');
  });

  it('[2.2-UNIT-007d] should index all selected files on bulk Learn This via forkJoin', () => {
    fixture.detectChanges();

    component.toggleSelect('a1');
    component.toggleSelect('a2');
    expect(component.selectedIds().size).toBe(2);

    component.indexSelected();

    expect(mockAssetService.indexAsset).toHaveBeenCalledWith('a1');
    expect(mockAssetService.indexAsset).toHaveBeenCalledWith('a2');
    expect(component.selectedIds().size).toBe(0);
    // Both should remain in indexingIds until polling confirms isIndexed=true
    expect(component.indexingIds().has('a1')).toBe(true);
    expect(component.indexingIds().has('a2')).toBe(true);
  });

  it('[2.2-UNIT-007e] should stop polling when indexing completes', () => {
    fixture.detectChanges();

    // Start indexing
    component.onIndexAsset('a1');
    expect(component.indexingIds().has('a1')).toBe(true);

    // Simulate polling: return assets with isIndexed=true
    const indexedAssets = mockAssets.map((a) =>
      a.id === 'a1' ? { ...a, isIndexed: true } : a,
    );
    mockAssetService.findAll.mockReturnValue(of(indexedAssets));

    // Advance timer past poll interval
    jest.advanceTimersByTime(3000);

    expect(component.indexingIds().has('a1')).toBe(false);
    expect(component.indexingIds().size).toBe(0);
  });

  it('[2.2-UNIT-007f] should clean up poll timer on destroy', () => {
    fixture.detectChanges();

    // Start indexing to activate polling
    component.onIndexAsset('a1');

    // Destroy component
    fixture.destroy();

    // Advancing timers should not trigger any additional findAll calls
    const callCountBefore = mockAssetService.findAll.mock.calls.length;
    jest.advanceTimersByTime(6000);
    expect(mockAssetService.findAll.mock.calls.length).toBe(callCountBefore);
  });
});
