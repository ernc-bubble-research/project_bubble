import { Component, DestroyRef, input, output, signal, OnInit, effect, untracked, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  selector: 'app-workflow-search',
  template: `
    <div class="search-container">
      <lucide-icon name="search" [size]="16" class="search-icon"></lucide-icon>
      <input
        type="text"
        class="search-input"
        [placeholder]="placeholder()"
        [value]="searchValue()"
        (input)="onInput($event)"
        data-testid="workflow-search-input"
      />
      @if (searchValue()) {
        <button
          class="clear-button"
          (click)="clearSearch()"
          data-testid="workflow-search-clear"
          type="button"
        >
          <lucide-icon name="x" [size]="14"></lucide-icon>
        </button>
      }
    </div>
  `,
  styles: [`
    .search-container {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 320px;
    }

    .search-icon {
      position: absolute;
      left: 12px;
      color: var(--text-tertiary);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 10px 36px 10px 36px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 14px;
      font-family: inherit;
      color: var(--text-main);
      background: var(--bg-surface);
      transition: border-color 0.2s, box-shadow 0.2s;

      &::placeholder {
        color: var(--text-tertiary);
      }

      &:focus {
        outline: none;
        border-color: var(--primary-600);
        box-shadow: 0 0 0 3px var(--primary-100);
      }
    }

    .clear-button {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
      border-radius: var(--radius-sm);

      &:hover {
        color: var(--text-secondary);
        background: var(--slate-100);
      }
    }
  `],
})
export class WorkflowSearchComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchSubject = new Subject<string>();

  value = input<string>('');
  placeholder = input<string>('Search workflows...');
  debounceMs = input<number>(300);
  searchChange = output<string>();

  searchValue = signal<string>('');

  constructor() {
    // Sync searchValue when parent value input changes (e.g., "Clear filters")
    // Use untracked to avoid re-running when searchValue changes
    effect(() => {
      const externalValue = this.value();
      const currentValue = untracked(() => this.searchValue());
      if (externalValue !== currentValue) {
        this.searchValue.set(externalValue);
      }
    });
  }

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(this.debounceMs()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(value => {
      this.searchChange.emit(value);
    });
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue.set(value);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchValue.set('');
    this.searchSubject.next('');
  }
}
