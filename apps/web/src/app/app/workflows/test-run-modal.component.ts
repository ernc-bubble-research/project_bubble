import { Component, signal, input, viewChild, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowRunFormComponent } from './workflow-run-form.component';
import { TestRunService, TestRunEvent } from '../../core/services/test-run.service';
import { ToastService } from '../../core/services/toast.service';
import type { WorkflowTemplateResponseDto } from '@project-bubble/shared';

/**
 * Modal component for displaying real-time workflow test run progress.
 * Opened via test buttons on workflow cards and wizard header.
 */
@Component({
  selector: 'app-test-run-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, WorkflowRunFormComponent],
  template: `
    @if (isOpen()) {
      <div
        class="modal-backdrop"
        data-testid="test-run-modal"
        (click)="onBackdropClick($event)"
      >
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 data-testid="modal-title">Test Workflow</h2>
            <button
              type="button"
              class="close-button"
              data-testid="close-button"
              (click)="close()"
              aria-label="Close modal"
            >
              <lucide-icon name="x" [size]="20"></lucide-icon>
            </button>
          </div>

          <div class="modal-body">
            @if (template() && !isRunning() && !testCompleted()) {
              <app-workflow-run-form [templateInput]="template()"></app-workflow-run-form>
            }

            @if (statusMessage()) {
              <div class="status-message">{{ statusMessage() }}</div>
            }

            @if (isRunning() || testCompleted()) {
              <div class="results-section">
                <div class="results-header">
                  <h3>Test Results</h3>
                  @if (testCompleted()) {
                    <button
                      type="button"
                      class="btn-secondary"
                      data-testid="export-json-button"
                      (click)="onExport()"
                    >
                      Export JSON
                    </button>
                  }
                </div>
                <div class="results-panes">
                  <div class="result-pane">
                    <h4>Prompt</h4>
                    <pre class="result-content">{{ currentPrompt() || 'Waiting...' }}</pre>
                  </div>
                  <div class="result-pane">
                    <h4>Output</h4>
                    <pre class="result-content">{{ currentOutput() || 'Waiting...' }}</pre>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="modal-footer" data-testid="modal-footer">
            <button
              type="button"
              class="btn-secondary"
              data-testid="close-footer-button"
              (click)="close()"
            >
              Close
            </button>
            @if (!testCompleted()) {
              <button
                type="button"
                class="btn-primary"
                data-testid="run-test-button"
                [disabled]="isRunning()"
                (click)="onRunTest()"
              >
                @if (isRunning()) {
                  Running...
                } @else {
                  Run Test
                }
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-container {
      background-color: white;
      border-radius: 8px;
      max-width: 1200px;
      width: 90%;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .close-button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      transition: color 0.15s ease-in-out;
    }

    .close-button:hover {
      color: #111827;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .results-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .btn-primary {
      background-color: #3b82f6;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease-in-out;
    }

    .btn-primary:hover {
      background-color: #2563eb;
    }

    .btn-primary:disabled {
      background-color: #9ca3af;
      cursor: not-allowed;
    }

    .btn-secondary {
      background-color: white;
      color: #374151;
      border: 1px solid #d1d5db;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
    }

    .btn-secondary:hover {
      background-color: #f9fafb;
      border-color: #9ca3af;
    }

    .status-message {
      padding: 0.75rem;
      background-color: #eff6ff;
      border-left: 3px solid #3b82f6;
      color: #1e40af;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .results-section {
      margin-top: 1rem;
    }

    .results-section .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .results-section h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .results-panes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .result-pane {
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      overflow: hidden;
    }

    .result-pane h4 {
      margin: 0;
      padding: 0.5rem 0.75rem;
      background-color: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
    }

    .result-content {
      margin: 0;
      padding: 0.75rem;
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow-y: auto;
      max-height: 300px;
      background-color: white;
    }
  `],
})
export class TestRunModalComponent {
  private readonly testRunService = inject(TestRunService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Template input from parent component */
  readonly template = input<WorkflowTemplateResponseDto | null>(null);

  /** ViewChild reference to workflow form component */
  readonly formComponent = viewChild<WorkflowRunFormComponent>(WorkflowRunFormComponent);

  /** Signal controlling modal visibility */
  isOpen = signal(false);

  /** Signal indicating test run is in progress */
  isRunning = signal(false);

  /** Signal indicating test run completion */
  testCompleted = signal(false);

  /** Current session ID */
  sessionId = signal<string | null>(null);

  /** Test run status message */
  statusMessage = signal<string>('');

  /** Current file results */
  currentPrompt = signal<string>('');
  currentOutput = signal<string>('');

  /** Opens the modal */
  open(): void {
    this.isOpen.set(true);
  }

  /** Closes the modal */
  close(): void {
    this.cleanup();
    this.isOpen.set(false);
  }

  /** Cleans up resources when modal closes (AC10) */
  cleanup(): void {
    this.testRunService.disconnect();
    this.isRunning.set(false);
    this.testCompleted.set(false);
    this.sessionId.set(null);
    this.statusMessage.set('');
    this.currentPrompt.set('');
    this.currentOutput.set('');
  }

  /** Handles backdrop click to close modal */
  onBackdropClick(event: MouseEvent): void {
    this.close();
  }

  /** Initiates test run (AC5) */
  onRunTest(): void {
    const tmpl = this.template();
    const form = this.formComponent();

    if (!tmpl || !form) {
      this.toast.show('Form not ready');
      return;
    }

    if (!form.formValid()) {
      this.toast.show('Please fill all required inputs');
      return;
    }

    const inputs = form.getFormValues();

    this.isRunning.set(true);
    this.statusMessage.set('Initiating test run...');

    // AC5 step 1-2: POST to initiate test run
    this.testRunService
      .initiateTestRun(tmpl.id, inputs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const sid = response.sessionId;
          this.sessionId.set(sid);
          this.connectWebSocket(sid);
        },
        error: (err) => {
          this.isRunning.set(false);
          const msg = err?.error?.message || 'Failed to initiate test run';
          this.toast.show(msg);
          this.statusMessage.set(`Error: ${msg}`);
        },
      });
  }

  /** Connects to WebSocket for real-time updates (AC5 step 3-7) */
  private connectWebSocket(sessionId: string): void {
    this.statusMessage.set('Connecting to test run...');

    this.testRunService
      .connectWebSocket(sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event: TestRunEvent) => {
          this.handleWebSocketEvent(event);
        },
        error: (err) => {
          this.isRunning.set(false);
          this.toast.show('Real-time updates unavailable');
          this.statusMessage.set('Connection lost. Test may still be running.');
        },
      });
  }

  /** Handles WebSocket events (AC6-AC9) */
  private handleWebSocketEvent(event: TestRunEvent): void {
    switch (event.type) {
      case 'file-start':
        // AC6: File processing started
        this.statusMessage.set(
          `Processing file ${event.data.fileIndex + 1}: ${event.data.fileName}`
        );
        this.currentPrompt.set('Assembling prompt...');
        this.currentOutput.set('Waiting for LLM response...');
        break;

      case 'file-complete':
        // AC6: File processing completed
        this.currentPrompt.set(event.data.assembledPrompt || 'No prompt data');
        if (event.data.status === 'error') {
          this.currentOutput.set(`Error: ${event.data.errorMessage || 'Unknown error'}`);
        } else {
          this.currentOutput.set(event.data.llmResponse || 'No output');
        }
        break;

      case 'complete':
        // AC7: Test run completed
        this.isRunning.set(false);
        this.testCompleted.set(true);
        this.testRunService.disconnect();
        const { successCount, totalFiles, failedCount } = event.data;
        const msg =
          failedCount > 0
            ? `Test complete: ${successCount}/${totalFiles} succeeded, ${failedCount} failed`
            : `Test complete: ${successCount}/${totalFiles} files succeeded`;
        this.toast.show(msg);
        this.statusMessage.set(msg);
        break;

      case 'error':
        // AC9: Error occurred
        this.isRunning.set(false);
        this.testRunService.disconnect();
        this.toast.show(`Test run failed: ${event.data.errorMessage}`);
        this.statusMessage.set(`Error: ${event.data.errorMessage}`);
        break;
    }
  }

  /** Exports test run results as JSON (AC8, Task 7) */
  onExport(): void {
    const sid = this.sessionId();
    if (!sid) return;

    this.testRunService
      .exportResults(sid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          // AC8 step 3: Trigger browser download
          const tmpl = this.template();
          // Timestamp format: 2026-02-20T23-15-36 (ISO without milliseconds, colons replaced for filesystem safety)
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const filename = `test-run-${tmpl?.name || 'workflow'}-${timestamp}.json`;

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(url);

          this.toast.show('Test results exported');
        },
        error: (err) => {
          if (err.status === 404) {
            // Test results expire after 5 minutes (backend NodeCache TTL)
            this.toast.show('Test results expired (5-minute limit). Please re-run test.');
          } else {
            this.toast.show('Failed to export test results');
          }
        },
      });
  }
}
