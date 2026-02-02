import { Component, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { FolderResponseDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [NgClass, FormsModule, LucideAngularModule],
  selector: 'app-folder-tree',
  template: `
    <div class="folder-tree">
      <button
        class="folder-item"
        [ngClass]="{ active: activeFolderId() === null }"
        (click)="folderSelect.emit(null)"
        (keydown.enter)="folderSelect.emit(null)"
      >
        <lucide-icon name="files" [size]="16"></lucide-icon>
        <span>All Files</span>
      </button>

      @for (folder of rootFolders(); track folder.id) {
        <div class="folder-row">
          <button
            class="folder-item"
            [ngClass]="{ active: activeFolderId() === folder.id }"
            (click)="folderSelect.emit(folder.id)"
            (keydown.enter)="folderSelect.emit(folder.id)"
          >
            <lucide-icon name="folder" [size]="16"></lucide-icon>
            @if (renamingId() === folder.id) {
              <input
                class="rename-input"
                [ngModel]="renameValue()"
                (ngModelChange)="renameValue.set($event)"
                (keydown.enter)="confirmRename(folder.id)"
                (keydown.escape)="cancelRename()"
                (blur)="confirmRename(folder.id)"
                (click)="$event.stopPropagation()"
              />
            } @else {
              <span>{{ folder.name }}</span>
            }
          </button>
          @if (renamingId() !== folder.id) {
            <button
              class="action-btn"
              title="Rename folder"
              (click)="startRename(folder, $event)"
              (keydown.enter)="startRename(folder, $event)"
            >
              <lucide-icon name="pencil" [size]="12"></lucide-icon>
            </button>
          }
        </div>

        @for (child of getChildren(folder.id); track child.id) {
          <div class="folder-row">
            <button
              class="folder-item nested"
              [ngClass]="{ active: activeFolderId() === child.id }"
              (click)="folderSelect.emit(child.id)"
              (keydown.enter)="folderSelect.emit(child.id)"
            >
              <lucide-icon name="folder" [size]="14"></lucide-icon>
              @if (renamingId() === child.id) {
                <input
                  class="rename-input"
                  [ngModel]="renameValue()"
                  (ngModelChange)="renameValue.set($event)"
                  (keydown.enter)="confirmRename(child.id)"
                  (keydown.escape)="cancelRename()"
                  (blur)="confirmRename(child.id)"
                  (click)="$event.stopPropagation()"
                />
              } @else {
                <span>{{ child.name }}</span>
              }
            </button>
            @if (renamingId() !== child.id) {
              <button
                class="action-btn"
                title="Rename folder"
                (click)="startRename(child, $event)"
                (keydown.enter)="startRename(child, $event)"
              >
                <lucide-icon name="pencil" [size]="12"></lucide-icon>
              </button>
            }
          </div>

          @for (grandchild of getChildren(child.id); track grandchild.id) {
            <div class="folder-row">
              <button
                class="folder-item nested-2"
                [ngClass]="{ active: activeFolderId() === grandchild.id }"
                (click)="folderSelect.emit(grandchild.id)"
                (keydown.enter)="folderSelect.emit(grandchild.id)"
              >
                <lucide-icon name="folder" [size]="14"></lucide-icon>
                @if (renamingId() === grandchild.id) {
                  <input
                    class="rename-input"
                    [ngModel]="renameValue()"
                    (ngModelChange)="renameValue.set($event)"
                    (keydown.enter)="confirmRename(grandchild.id)"
                    (keydown.escape)="cancelRename()"
                    (blur)="confirmRename(grandchild.id)"
                    (click)="$event.stopPropagation()"
                  />
                } @else {
                  <span>{{ grandchild.name }}</span>
                }
              </button>
              @if (renamingId() !== grandchild.id) {
                <button
                  class="action-btn"
                  title="Rename folder"
                  (click)="startRename(grandchild, $event)"
                  (keydown.enter)="startRename(grandchild, $event)"
                >
                  <lucide-icon name="pencil" [size]="12"></lucide-icon>
                </button>
              }
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .folder-tree {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .folder-row {
      display: flex;
      align-items: center;

      &:hover .action-btn {
        opacity: 1;
      }
    }

    .folder-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      color: var(--text-muted);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      flex: 1;
      min-width: 0;
      transition: all 0.15s ease;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.active {
        background: var(--primary-50, rgba(59, 130, 246, 0.1));
        color: var(--primary-600);
        font-weight: 600;
      }

      &.nested {
        padding-left: 28px;
        font-size: 12px;
      }

      &.nested-2 {
        padding-left: 44px;
        font-size: 12px;
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: var(--radius-sm);
      opacity: 0;
      transition: opacity 0.15s ease;
      flex-shrink: 0;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .rename-input {
      border: 1px solid var(--primary-400);
      border-radius: var(--radius-sm);
      padding: 2px 6px;
      font-size: 12px;
      background: var(--bg-surface);
      color: var(--text-primary);
      outline: none;
      width: 100%;
      min-width: 0;
    }
  `],
})
export class FolderTreeComponent {
  folders = input<FolderResponseDto[]>([]);
  activeFolderId = input<string | null>(null);
  folderSelect = output<string | null>();
  folderRename = output<{ id: string; name: string }>();

  renamingId = signal<string | null>(null);
  renameValue = signal('');

  rootFolders() {
    return this.folders().filter((f) => !f.parentId);
  }

  getChildren(parentId: string): FolderResponseDto[] {
    return this.folders().filter((f) => f.parentId === parentId);
  }

  startRename(folder: FolderResponseDto, event: Event): void {
    event.stopPropagation();
    this.renamingId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  confirmRename(id: string): void {
    const newName = this.renameValue().trim();
    if (newName && this.renamingId() === id) {
      this.folderRename.emit({ id, name: newName });
    }
    this.renamingId.set(null);
  }

  cancelRename(): void {
    this.renamingId.set(null);
  }
}
