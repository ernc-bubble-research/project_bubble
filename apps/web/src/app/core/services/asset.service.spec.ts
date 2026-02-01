import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AssetService } from './asset.service';
import { AssetResponseDto, FolderResponseDto } from '@project-bubble/shared';

const mockAsset: AssetResponseDto = {
  id: 'asset-1',
  originalName: 'test-file.pdf',
  isIndexed: false,
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  status: 'ready',
  tenantId: 't1',
  uploadedById: 'u1',
  createdAt: '2026-01-30T00:00:00Z',
  updatedAt: '2026-01-30T00:00:00Z',
} as AssetResponseDto;

const mockFolder: FolderResponseDto = {
  id: 'folder-1',
  name: 'Test Folder',
  tenantId: 't1',
  createdAt: '2026-01-30T00:00:00Z',
  updatedAt: '2026-01-30T00:00:00Z',
} as FolderResponseDto;

describe('AssetService [P2]', () => {
  let service: AssetService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AssetService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('[2.1-UNIT-045] should POST upload with FormData', () => {
    const file = new File(['content'], 'test.pdf', {
      type: 'application/pdf',
    });

    service.upload(file, 'folder-1').subscribe((result) => {
      expect(result).toEqual(mockAsset);
    });

    const req = httpTesting.expectOne('/api/app/assets');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);

    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBeTruthy();
    expect(formData.get('folderId')).toBe('folder-1');
    req.flush(mockAsset);
  });

  it('[2.1-UNIT-046] should GET all assets with no params', () => {
    service.findAll().subscribe((assets) => {
      expect(assets).toEqual([mockAsset]);
    });

    const req = httpTesting.expectOne('/api/app/assets');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([mockAsset]);
  });

  it('[2.1-UNIT-047] should GET all assets with query params', () => {
    service.findAll('folder-1', 'ready').subscribe((assets) => {
      expect(assets).toEqual([mockAsset]);
    });

    const req = httpTesting.expectOne(
      (r) =>
        r.url === '/api/app/assets' &&
        r.params.get('folderId') === 'folder-1' &&
        r.params.get('status') === 'ready',
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockAsset]);
  });

  it('[2.1-UNIT-048] should GET one asset by id', () => {
    service.findOne('asset-1').subscribe((asset) => {
      expect(asset).toEqual(mockAsset);
    });

    const req = httpTesting.expectOne('/api/app/assets/asset-1');
    expect(req.request.method).toBe('GET');
    req.flush(mockAsset);
  });

  it('[2.1-UNIT-049] should PATCH to update an asset', () => {
    const updateDto = { originalName: 'renamed.pdf' };

    service.update('asset-1', updateDto).subscribe((asset) => {
      expect(asset).toEqual({ ...mockAsset, originalName: 'renamed.pdf' });
    });

    const req = httpTesting.expectOne('/api/app/assets/asset-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updateDto);
    req.flush({ ...mockAsset, originalName: 'renamed.pdf' });
  });

  it('[2.1-UNIT-050] should DELETE to archive an asset', () => {
    service.archive('asset-1').subscribe((asset) => {
      expect(asset).toEqual(mockAsset);
    });

    const req = httpTesting.expectOne('/api/app/assets/asset-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(mockAsset);
  });

  it('[2.1-UNIT-051] should POST to restore an asset', () => {
    service.restore('asset-1').subscribe((asset) => {
      expect(asset).toEqual(mockAsset);
    });

    const req = httpTesting.expectOne('/api/app/assets/asset-1/restore');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(mockAsset);
  });

  it('[2.1-UNIT-052] should POST to create a folder', () => {
    const createDto = { name: 'New Folder' };

    service.createFolder(createDto).subscribe((folder) => {
      expect(folder).toEqual(mockFolder);
    });

    const req = httpTesting.expectOne('/api/app/folders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(createDto);
    req.flush(mockFolder);
  });

  it('[2.1-UNIT-053] should GET all folders', () => {
    service.findAllFolders().subscribe((folders) => {
      expect(folders).toEqual([mockFolder]);
    });

    const req = httpTesting.expectOne('/api/app/folders');
    expect(req.request.method).toBe('GET');
    req.flush([mockFolder]);
  });

  it('[2.1-UNIT-054] should DELETE a folder', () => {
    service.deleteFolder('folder-1').subscribe();

    const req = httpTesting.expectOne('/api/app/folders/folder-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
