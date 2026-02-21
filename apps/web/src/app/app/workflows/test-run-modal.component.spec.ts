import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { TestRunModalComponent } from './test-run-modal.component';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { X } from 'lucide-angular';
import { TestRunService, TestRunEvent } from '../../core/services/test-run.service';
import { ToastService } from '../../core/services/toast.service';

describe('TestRunModalComponent', () => {
  let component: TestRunModalComponent;
  let fixture: ComponentFixture<TestRunModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestRunModalComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ X }),
        },
        {
          provide: TestRunService,
          useValue: {
            disconnect: jest.fn(),
            initiateTestRun: jest.fn(),
            connectWebSocket: jest.fn(),
            exportResults: jest.fn(),
          },
        },
        {
          provide: ToastService,
          useValue: {
            show: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestRunModalComponent);
    component = fixture.componentInstance;
  });

  describe('Component Creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should be a standalone component', () => {
      const metadata = (TestRunModalComponent as any).ɵcmp;
      expect(metadata.standalone).toBe(true);
    });
  });

  describe('Modal Visibility', () => {
    it('should initialize with isOpen signal set to false', () => {
      expect(component.isOpen()).toBe(false);
    });

    it('should not render modal content when isOpen is false', async () => {
      component.isOpen.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const modal = fixture.nativeElement.querySelector('[data-testid="test-run-modal"]');
      expect(modal).toBeNull();
    });

    it('should render modal content when isOpen is true', async () => {
      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const modal = fixture.nativeElement.querySelector('[data-testid="test-run-modal"]');
      expect(modal).toBeTruthy();
    });

    it('should have open() method that sets isOpen to true', () => {
      expect(component.isOpen()).toBe(false);
      component.open();
      expect(component.isOpen()).toBe(true);
    });

    it('should have close() method that sets isOpen to false', () => {
      component.isOpen.set(true);
      expect(component.isOpen()).toBe(true);
      component.close();
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('Modal Header', () => {
    beforeEach(async () => {
      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should display "Test Workflow" as modal title', () => {
      const title = fixture.nativeElement.querySelector('[data-testid="modal-title"]');
      expect(title).toBeTruthy();
      expect(title.textContent.trim()).toBe('Test Workflow');
    });

    it('should render close button in header', () => {
      const closeButton = fixture.nativeElement.querySelector('[data-testid="close-button"]');
      expect(closeButton).toBeTruthy();
    });

    it('should close modal when close button is clicked', async () => {
      expect(component.isOpen()).toBe(true);

      const closeButton = fixture.nativeElement.querySelector('[data-testid="close-button"]');
      closeButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isOpen()).toBe(false);
    });

    it('should close modal when backdrop is clicked', async () => {
      expect(component.isOpen()).toBe(true);

      const backdrop = fixture.nativeElement.querySelector('[data-testid="test-run-modal"]');
      backdrop.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isOpen()).toBe(false);
    });

    it('should NOT close modal when modal container is clicked', async () => {
      expect(component.isOpen()).toBe(true);

      const container = fixture.nativeElement.querySelector('.modal-container');
      container.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isOpen()).toBe(true);
    });
  });

  describe('Full-Screen Layout & Scrolling (AC3)', () => {
    beforeEach(async () => {
      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should render backdrop with modal-backdrop class', () => {
      const backdrop = fixture.nativeElement.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
      expect(backdrop.classList.contains('modal-backdrop')).toBe(true);
    });

    it('should render modal container with modal-container class', () => {
      const container = fixture.nativeElement.querySelector('.modal-container');
      expect(container).toBeTruthy();
      expect(container.classList.contains('modal-container')).toBe(true);
    });

    it('should have modal-body for scrollable content', () => {
      const body = fixture.nativeElement.querySelector('.modal-body');
      expect(body).toBeTruthy();
      expect(body.classList.contains('modal-body')).toBe(true);
    });
  });

  describe('Footer with Action Buttons (AC3)', () => {
    beforeEach(async () => {
      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should render footer with Run Test and Close buttons', () => {
      const footer = fixture.nativeElement.querySelector('[data-testid="modal-footer"]');
      expect(footer).toBeTruthy();

      const runButton = fixture.nativeElement.querySelector('[data-testid="run-test-button"]');
      expect(runButton).toBeTruthy();
      expect(runButton.textContent.trim()).toContain('Run Test');

      const closeButton = fixture.nativeElement.querySelector('[data-testid="close-footer-button"]');
      expect(closeButton).toBeTruthy();
      expect(closeButton.textContent.trim()).toContain('Close');
    });

    it('should close modal when footer Close button is clicked', async () => {
      expect(component.isOpen()).toBe(true);

      const closeButton = fixture.nativeElement.querySelector('[data-testid="close-footer-button"]');
      closeButton.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isOpen()).toBe(false);
    });

    it('should have primary styling on Run Test button', () => {
      const runButton = fixture.nativeElement.querySelector('[data-testid="run-test-button"]');
      expect(runButton.classList.contains('btn-primary')).toBe(true);
    });

    it('should have secondary styling on Close button', () => {
      const closeButton = fixture.nativeElement.querySelector('[data-testid="close-footer-button"]');
      expect(closeButton.classList.contains('btn-secondary')).toBe(true);
    });
  });

  describe('Export JSON Button Visibility (AC3, AC8)', () => {
    beforeEach(async () => {
      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should NOT show Export JSON button initially', () => {
      const exportButton = fixture.nativeElement.querySelector('[data-testid="export-json-button"]');
      expect(exportButton).toBeNull();
    });

    it('should show Export JSON button when test completes', async () => {
      component.testCompleted.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const exportButton = fixture.nativeElement.querySelector('[data-testid="export-json-button"]');
      expect(exportButton).toBeTruthy();
      expect(exportButton.textContent.trim()).toContain('Export JSON');
    });
  });

  describe('WebSocket Cleanup & Resource Management (AC10)', () => {
    it('should have cleanup method that completes observables', () => {
      expect(component.cleanup).toBeDefined();
      expect(typeof component.cleanup).toBe('function');
    });

    it('should call cleanup when modal closes', async () => {
      const cleanupSpy = jest.spyOn(component, 'cleanup');

      component.isOpen.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      component.close();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should reset testCompleted state on cleanup', () => {
      component.testCompleted.set(true);
      expect(component.testCompleted()).toBe(true);

      component.cleanup();

      expect(component.testCompleted()).toBe(false);
    });
  });

  describe('WebSocket Event Handling (AC6, AC9) - Pass 3 C2', () => {
    it('should handle file-start event and update UI state', () => {
      const event = {
        type: 'file-start' as const,
        data: {
          sessionId: 'test-session',
          fileIndex: 0,
          fileName: 'test-file.pdf',
        },
      };

      component['handleWebSocketEvent'](event);

      expect(component.statusMessage()).toContain('Processing file 1');
      expect(component.statusMessage()).toContain('test-file.pdf');
      expect(component.currentPrompt()).toBe('Assembling prompt...');
      expect(component.currentOutput()).toBe('Waiting for LLM response...');
    });

    it('should handle file-complete event with success status', () => {
      const event = {
        type: 'file-complete' as const,
        data: {
          sessionId: 'test-session',
          fileIndex: 0,
          fileName: 'test-file.pdf',
          assembledPrompt: 'Test prompt content',
          llmResponse: 'Test LLM output',
          status: 'success' as const,
        },
      };

      component['handleWebSocketEvent'](event);

      expect(component.currentPrompt()).toBe('Test prompt content');
      expect(component.currentOutput()).toBe('Test LLM output');
    });

    it('should handle file-complete event with error status', () => {
      const event = {
        type: 'file-complete' as const,
        data: {
          sessionId: 'test-session',
          fileIndex: 0,
          fileName: 'test-file.pdf',
          assembledPrompt: 'Test prompt',
          status: 'error' as const,
          errorMessage: 'LLM provider timeout',
        },
      };

      component['handleWebSocketEvent'](event);

      expect(component.currentPrompt()).toBe('Test prompt');
      expect(component.currentOutput()).toContain('Error:');
      expect(component.currentOutput()).toContain('LLM provider timeout');
    });

    it('should handle complete event and update final state', () => {
      const event = {
        type: 'complete' as const,
        data: {
          sessionId: 'test-session',
          totalFiles: 5,
          successCount: 4,
          failedCount: 1,
        },
      };

      component.isRunning.set(true);
      component['handleWebSocketEvent'](event);

      expect(component.isRunning()).toBe(false);
      expect(component.testCompleted()).toBe(true);
      expect(component.statusMessage()).toContain('4/5 succeeded');
      expect(component.statusMessage()).toContain('1 failed');
    });

    it('should handle complete event with all files succeeded', () => {
      const event = {
        type: 'complete' as const,
        data: {
          sessionId: 'test-session',
          totalFiles: 3,
          successCount: 3,
          failedCount: 0,
        },
      };

      component.isRunning.set(true);
      component['handleWebSocketEvent'](event);

      expect(component.statusMessage()).toContain('3/3 files succeeded');
      expect(component.statusMessage()).not.toContain('failed');
    });

    it('should handle error event and reset running state', () => {
      const event = {
        type: 'error' as const,
        data: {
          sessionId: 'test-session',
          errorMessage: 'Template not found',
        },
      };

      component.isRunning.set(true);
      component['handleWebSocketEvent'](event);

      expect(component.isRunning()).toBe(false);
      expect(component.statusMessage()).toContain('Error:');
      expect(component.statusMessage()).toContain('Template not found');
    });

    it('should disconnect WebSocket on complete event', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const disconnectSpy = jest.spyOn(testRunService, 'disconnect');

      const event = {
        type: 'complete' as const,
        data: {
          sessionId: 'test-session',
          totalFiles: 1,
          successCount: 1,
          failedCount: 0,
        },
      };

      component['handleWebSocketEvent'](event);

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should disconnect WebSocket on error event', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const disconnectSpy = jest.spyOn(testRunService, 'disconnect');

      const event = {
        type: 'error' as const,
        data: {
          sessionId: 'test-session',
          errorMessage: 'Network error',
        },
      };

      component['handleWebSocketEvent'](event);

      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Error Paths (AC5, AC9) - Pass 3 M1', () => {
    it('should handle HTTP POST failure when initiating test run', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      jest.spyOn(testRunService, 'initiateTestRun').mockReturnValue(
        throwError(() => ({ error: { message: 'Template not found' } }))
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      // Set up template and mock form
      const mockTemplate = {
        id: 'template-123',
        name: 'Test Template',
      } as any;
      fixture.componentRef.setInput('template', mockTemplate);

      // Mock the form component
      const mockForm = {
        formValid: jest.fn().mockReturnValue(true),
        getFormValues: jest.fn().mockReturnValue({ context_doc: { type: 'text', text: 'test' } }),
      };
      jest.spyOn(component, 'formComponent').mockReturnValue(mockForm as any);

      // Don't call detectChanges to avoid rendering WorkflowRunFormComponent
      component.onRunTest();

      expect(component.isRunning()).toBe(false);
      expect(component.statusMessage()).toContain('Error:');
      expect(component.statusMessage()).toContain('Template not found');
      expect(toastSpy).toHaveBeenCalledWith('Template not found');
    });

    it('should handle HTTP POST failure with generic message when error has no message', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      jest.spyOn(testRunService, 'initiateTestRun').mockReturnValue(
        throwError(() => ({}))
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      // Set up template and mock form
      const mockTemplate = {
        id: 'template-123',
        name: 'Test Template',
      } as any;
      fixture.componentRef.setInput('template', mockTemplate);

      const mockForm = {
        formValid: jest.fn().mockReturnValue(true),
        getFormValues: jest.fn().mockReturnValue({ context_doc: { type: 'text', text: 'test' } }),
      };
      jest.spyOn(component, 'formComponent').mockReturnValue(mockForm as any);

      component.onRunTest();

      expect(component.isRunning()).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith('Failed to initiate test run');
    });

    it('should handle WebSocket connection error', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      jest.spyOn(testRunService, 'initiateTestRun').mockReturnValue(
        of({ sessionId: 'test-session-123' })
      );
      jest.spyOn(testRunService, 'connectWebSocket').mockReturnValue(
        throwError(() => new Error('Connection refused'))
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      // Set up template and mock form
      const mockTemplate = {
        id: 'template-123',
        name: 'Test Template',
      } as any;
      fixture.componentRef.setInput('template', mockTemplate);

      const mockForm = {
        formValid: jest.fn().mockReturnValue(true),
        getFormValues: jest.fn().mockReturnValue({ context_doc: { type: 'text', text: 'test' } }),
      };
      jest.spyOn(component, 'formComponent').mockReturnValue(mockForm as any);

      component.onRunTest();

      expect(component.isRunning()).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith('Real-time updates unavailable');
      expect(component.statusMessage()).toBe('Connection lost. Test may still be running.');
    });

    it('should show toast when error event received', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      const toastSpy = jest.spyOn(toastService, 'show');

      const event = {
        type: 'error' as const,
        data: {
          sessionId: 'test-session',
          errorMessage: 'Insufficient credits',
        },
      };

      component.isRunning.set(true);
      component['handleWebSocketEvent'](event);

      expect(toastSpy).toHaveBeenCalledWith('Test run failed: Insufficient credits');
    });

    it('should show toast when test completes with failures', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      const toastSpy = jest.spyOn(toastService, 'show');

      const event = {
        type: 'complete' as const,
        data: {
          sessionId: 'test-session',
          totalFiles: 5,
          successCount: 3,
          failedCount: 2,
        },
      };

      component.isRunning.set(true);
      component['handleWebSocketEvent'](event);

      expect(toastSpy).toHaveBeenCalledWith('Test complete: 3/5 succeeded, 2 failed');
    });

    it('should handle export 404 error with expiration message', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      jest.spyOn(testRunService, 'exportResults').mockReturnValue(
        throwError(() => ({ status: 404 }))
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      component.sessionId.set('test-session-123');
      component.onExport();

      expect(toastSpy).toHaveBeenCalledWith('Test results expired (5-minute limit). Please re-run test.');
    });

    it('should handle export generic error', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      jest.spyOn(testRunService, 'exportResults').mockReturnValue(
        throwError(() => ({ status: 500 }))
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      component.sessionId.set('test-session-123');
      component.onExport();

      expect(toastSpy).toHaveBeenCalledWith('Failed to export test results');
    });
  });

  describe('Full Flow Sequence (AC5-AC8) - Pass 3 M3', () => {
    it('should execute complete test run flow from initiation to completion', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const toastService = fixture.debugElement.injector.get(ToastService);
      const eventSubject = new Subject<TestRunEvent>();

      // Mock service calls
      jest.spyOn(testRunService, 'initiateTestRun').mockReturnValue(
        of({ sessionId: 'flow-test-session' })
      );
      jest.spyOn(testRunService, 'connectWebSocket').mockReturnValue(
        eventSubject.asObservable()
      );
      const toastSpy = jest.spyOn(toastService, 'show');

      // Set up template and mock form
      const mockTemplate = {
        id: 'template-123',
        name: 'Test Template',
      } as any;
      fixture.componentRef.setInput('template', mockTemplate);

      const mockForm = {
        formValid: jest.fn().mockReturnValue(true),
        getFormValues: jest.fn().mockReturnValue({ context_doc: { type: 'text', text: 'test' } }),
      };
      jest.spyOn(component, 'formComponent').mockReturnValue(mockForm as any);

      // Step 1: Initiate test run
      component.onRunTest();

      expect(component.isRunning()).toBe(true);
      expect(component.statusMessage()).toContain('Connecting to test run');
      expect(component.sessionId()).toBe('flow-test-session');

      // Step 2: Emit file-start event
      eventSubject.next({
        type: 'file-start',
        data: {
          sessionId: 'flow-test-session',
          fileIndex: 0,
          fileName: 'document.pdf',
        },
      });

      expect(component.statusMessage()).toContain('Processing file 1');
      expect(component.statusMessage()).toContain('document.pdf');
      expect(component.currentPrompt()).toBe('Assembling prompt...');
      expect(component.currentOutput()).toBe('Waiting for LLM response...');

      // Step 3: Emit file-complete event
      eventSubject.next({
        type: 'file-complete',
        data: {
          sessionId: 'flow-test-session',
          fileIndex: 0,
          fileName: 'document.pdf',
          assembledPrompt: 'Analyze this document: [content]',
          llmResponse: 'Analysis result: Document contains important information.',
          status: 'success',
        },
      });

      expect(component.currentPrompt()).toBe('Analyze this document: [content]');
      expect(component.currentOutput()).toBe('Analysis result: Document contains important information.');

      // Step 4: Emit complete event
      eventSubject.next({
        type: 'complete',
        data: {
          sessionId: 'flow-test-session',
          totalFiles: 1,
          successCount: 1,
          failedCount: 0,
        },
      });

      expect(component.isRunning()).toBe(false);
      expect(component.testCompleted()).toBe(true);
      expect(component.statusMessage()).toContain('1/1 files succeeded');
      expect(toastSpy).toHaveBeenCalledWith('Test complete: 1/1 files succeeded');

      // Step 5: Verify export button state
      // Export button appears when testCompleted is true (verified in template conditional)
      expect(component.testCompleted()).toBe(true);

      // Cleanup
      eventSubject.complete();
    });

    it('should handle flow with multiple files and partial failure', () => {
      const testRunService = fixture.debugElement.injector.get(TestRunService);
      const eventSubject = new Subject<TestRunEvent>();

      jest.spyOn(testRunService, 'initiateTestRun').mockReturnValue(
        of({ sessionId: 'multi-file-session' })
      );
      jest.spyOn(testRunService, 'connectWebSocket').mockReturnValue(
        eventSubject.asObservable()
      );

      const mockTemplate = { id: 'template-123', name: 'Test' } as any;
      fixture.componentRef.setInput('template', mockTemplate);

      const mockForm = {
        formValid: jest.fn().mockReturnValue(true),
        getFormValues: jest.fn().mockReturnValue({}),
      };
      jest.spyOn(component, 'formComponent').mockReturnValue(mockForm as any);

      component.onRunTest();

      // File 1: Success
      eventSubject.next({
        type: 'file-start',
        data: { sessionId: 'multi-file-session', fileIndex: 0, fileName: 'file1.pdf' },
      });
      eventSubject.next({
        type: 'file-complete',
        data: {
          sessionId: 'multi-file-session',
          fileIndex: 0,
          fileName: 'file1.pdf',
          assembledPrompt: 'Prompt 1',
          llmResponse: 'Response 1',
          status: 'success',
        },
      });

      expect(component.currentPrompt()).toBe('Prompt 1');
      expect(component.currentOutput()).toBe('Response 1');

      // File 2: Error
      eventSubject.next({
        type: 'file-start',
        data: { sessionId: 'multi-file-session', fileIndex: 1, fileName: 'file2.pdf' },
      });
      eventSubject.next({
        type: 'file-complete',
        data: {
          sessionId: 'multi-file-session',
          fileIndex: 1,
          fileName: 'file2.pdf',
          assembledPrompt: 'Prompt 2',
          status: 'error',
          errorMessage: 'LLM timeout',
        },
      });

      expect(component.currentPrompt()).toBe('Prompt 2');
      expect(component.currentOutput()).toContain('Error:');
      expect(component.currentOutput()).toContain('LLM timeout');

      // Complete with partial failure
      eventSubject.next({
        type: 'complete',
        data: {
          sessionId: 'multi-file-session',
          totalFiles: 2,
          successCount: 1,
          failedCount: 1,
        },
      });

      expect(component.testCompleted()).toBe(true);
      expect(component.statusMessage()).toContain('1/2 succeeded');
      expect(component.statusMessage()).toContain('1 failed');

      eventSubject.complete();
    });
  });
});
