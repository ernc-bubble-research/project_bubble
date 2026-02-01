import { Component, input, output, signal, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AssetService } from '../../core/services/asset.service';

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

@Component({
  standalone: true,
  imports: [NgClass, LucideAngularModule],
  selector: 'app-upload-zone',
  template: `
    <div
      class="upload-zone"
      [ngClass]="{ dragover: isDragover() }"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <div class="upload-content">
        <lucide-icon name="upload-cloud" [size]="24"></lucide-icon>
        <span>Drag & drop files here or
          <label class="browse-link">
            browse
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx"
              (change)="onFileSelect($event)"
              hidden
            />
          </label>
        </span>
        <small>PDF, TXT, MD, DOCX — Max 10MB</small>
      </div>

      @if (uploads().length > 0) {
        <div class="upload-list">
          @for (item of uploads(); track item.file.name) {
            <div class="upload-item" [ngClass]="item.status">
              <span class="upload-name">{{ item.file.name }}</span>
              @if (item.status === 'uploading') {
                <span class="upload-status">Uploading...</span>
              } @else if (item.status === 'done') {
                <lucide-icon name="check-circle" [size]="16"></lucide-icon>
              } @else if (item.status === 'error') {
                <span class="upload-error">{{ item.error }}</span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .upload-zone {
      border: 2px dashed var(--border-default);
      border-radius: var(--radius-lg);
      padding: 20px;
      text-align: center;
      transition: all 0.2s ease;
      margin-top: 16px;

      &.dragover {
        border-color: var(--primary-500);
        background: var(--primary-50, rgba(59, 130, 246, 0.05));
      }
    }

    .upload-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      color: var(--text-muted);
      font-size: 13px;

      small {
        font-size: 11px;
        color: var(--text-muted);
      }
    }

    .browse-link {
      color: var(--primary-600);
      cursor: pointer;
      text-decoration: underline;
    }

    .upload-list {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .upload-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      font-size: 12px;

      &.done { color: var(--success-600, #16a34a); }
      &.error { color: var(--danger-600, #dc2626); }
    }

    .upload-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    .upload-error {
      font-size: 11px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .upload-status {
      font-size: 11px;
      color: var(--text-muted);
    }
  `],
})
export class UploadZoneComponent {
  folderId = input<string | null>(null);
  uploadComplete = output<void>();

  private readonly assetService = inject(AssetService);

  isDragover = signal(false);
  uploads = signal<UploadItem[]>([]);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragover.set(true);
  }

  onDragLeave(): void {
    this.isDragover.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragover.set(false);
    const files = event.dataTransfer?.files;
    if (files) {
      this.processFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private processFiles(files: File[]): void {
    const items: UploadItem[] = files.map((file) => ({
      file,
      progress: 0,
      status: 'pending' as const,
    }));
    this.uploads.set(items);

    for (const item of items) {
      item.status = 'uploading';
      this.uploads.update((list) => [...list]);

      this.assetService
        .upload(item.file, this.folderId() || undefined)
        .subscribe({
          next: () => {
            item.status = 'done';
            item.progress = 100;
            this.uploads.update((list) => [...list]);
            this.uploadComplete.emit();
          },
          error: (err) => {
            item.status = 'error';
            item.error = err?.error?.message || 'Upload failed';
            this.uploads.update((list) => [...list]);
          },
        });
    }
  }
}
