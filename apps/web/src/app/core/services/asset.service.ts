import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AssetResponseDto,
  FolderResponseDto,
  CreateFolderDto,
  UpdateFolderDto,
  UpdateAssetDto,
  IndexAssetResponseDto,
} from '@project-bubble/shared';

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly http = inject(HttpClient);
  private readonly assetsUrl = '/api/app/assets';
  private readonly foldersUrl = '/api/app/folders';

  // ---- Assets ----

  upload(file: File, folderId?: string): Observable<AssetResponseDto> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }
    return this.http.post<AssetResponseDto>(this.assetsUrl, formData);
  }

  findAll(folderId?: string, status?: string): Observable<AssetResponseDto[]> {
    let params = new HttpParams();
    if (folderId) params = params.set('folderId', folderId);
    if (status) params = params.set('status', status);
    return this.http.get<AssetResponseDto[]>(this.assetsUrl, { params });
  }

  findOne(id: string): Observable<AssetResponseDto> {
    return this.http.get<AssetResponseDto>(`${this.assetsUrl}/${id}`);
  }

  update(id: string, dto: UpdateAssetDto): Observable<AssetResponseDto> {
    return this.http.patch<AssetResponseDto>(`${this.assetsUrl}/${id}`, dto);
  }

  archive(id: string): Observable<AssetResponseDto> {
    return this.http.delete<AssetResponseDto>(`${this.assetsUrl}/${id}`);
  }

  restore(id: string): Observable<AssetResponseDto> {
    return this.http.post<AssetResponseDto>(`${this.assetsUrl}/${id}/restore`, {});
  }

  indexAsset(id: string): Observable<IndexAssetResponseDto> {
    return this.http.post<IndexAssetResponseDto>(`${this.assetsUrl}/${id}/index`, {});
  }

  deIndexAsset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.assetsUrl}/${id}/index`);
  }

  // ---- Folders ----

  createFolder(dto: CreateFolderDto): Observable<FolderResponseDto> {
    return this.http.post<FolderResponseDto>(this.foldersUrl, dto);
  }

  findAllFolders(): Observable<FolderResponseDto[]> {
    return this.http.get<FolderResponseDto[]>(this.foldersUrl);
  }

  updateFolder(id: string, dto: UpdateFolderDto): Observable<FolderResponseDto> {
    return this.http.patch<FolderResponseDto>(`${this.foldersUrl}/${id}`, dto);
  }

  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.foldersUrl}/${id}`);
  }
}
