import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, throwError } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import type { ExecuteTestRunDto, TestRunFileResultDto } from '@project-bubble/shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TestRunFileStartEvent {
  sessionId: string;
  fileIndex: number;
  fileName: string;
}

export interface TestRunFileCompleteEvent extends TestRunFileResultDto {
  sessionId: string;
}

export interface TestRunCompleteEvent {
  sessionId: string;
  totalFiles: number;
  successCount: number;
  failedCount: number;
}

export interface TestRunErrorEvent {
  sessionId: string;
  errorMessage: string;
}

export type TestRunEvent =
  | { type: 'file-start'; data: TestRunFileStartEvent }
  | { type: 'file-complete'; data: TestRunFileCompleteEvent }
  | { type: 'complete'; data: TestRunCompleteEvent }
  | { type: 'error'; data: TestRunErrorEvent };

/**
 * Service for managing workflow test runs with WebSocket real-time updates.
 * AC5: WebSocket connection with JWT authentication
 * AC6-AC9: Real-time event handling
 */
@Injectable({
  providedIn: 'root',
})
export class TestRunService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private socket: Socket | null = null;
  private eventsSubject: Subject<TestRunEvent> | undefined;

  /**
   * Initiates a test run (AC5 step 1-2).
   * POST /api/admin/workflows/:id/test-run
   */
  initiateTestRun(
    templateId: string,
    inputs: Record<string, { type: 'asset' | 'text'; assetIds?: string[]; text?: string }>
  ): Observable<{ sessionId: string }> {
    const payload: ExecuteTestRunDto = { templateId, inputs };
    return this.http.post<{ sessionId: string }>(
      `/api/admin/workflows/${templateId}/test-run`,
      payload
    );
  }

  /**
   * Connects to WebSocket for real-time test run updates (AC5 step 3-7).
   * Validates sessionId (AC5 step 3), includes JWT token (AC5 step 4-5).
   * Returns Observable of typed events.
   */
  connectWebSocket(sessionId: string): Observable<TestRunEvent> {
    // AC5 step 3: Validate sessionId is UUID format (XSS prevention)
    if (!UUID_REGEX.test(sessionId)) {
      return throwError(() => new Error('Invalid sessionId format'));
    }

    // Clean up any existing connection
    this.disconnect();

    this.eventsSubject = new Subject<TestRunEvent>();

    // AC5 step 4: Extract JWT token from AuthService
    const jwtToken = this.auth.getToken();
    if (!jwtToken) {
      return throwError(() => new Error('No JWT token available'));
    }

    // AC5 step 5: Connect with sessionId and JWT token in query params
    // Note: environment.wsUrl is empty string (same origin). Socket.io interprets
    // relative paths by defaulting to window.location.origin, so '/test-runs'
    // connects to current host. Safe for dev (localhost) and production (same domain).
    this.socket = io(`${environment.wsUrl}/test-runs`, {
      query: { sessionId, token: jwtToken },
    });

    // AC6: Handle file-start events
    this.socket.on('test-run-file-start', (event: TestRunFileStartEvent) => {
      this.eventsSubject?.next({ type: 'file-start', data: event });
    });

    // AC6: Handle file-complete events
    this.socket.on('test-run-file-complete', (event: TestRunFileCompleteEvent) => {
      this.eventsSubject?.next({ type: 'file-complete', data: event });
    });

    // AC7: Handle test-run-complete events
    this.socket.on('test-run-complete', (event: TestRunCompleteEvent) => {
      this.eventsSubject?.next({ type: 'complete', data: event });
    });

    // AC9: Handle test-run-error events
    this.socket.on('test-run-error', (event: TestRunErrorEvent) => {
      this.eventsSubject?.next({ type: 'error', data: event });
    });

    // Handle WebSocket connection errors
    this.socket.on('connect_error', () => {
      this.eventsSubject?.error(new Error('WebSocket connection failed'));
    });

    // Handle server-initiated disconnect (cleanup state without calling disconnect again)
    this.socket.on('disconnect', () => {
      this.cleanupState();
    });

    return this.eventsSubject.asObservable();
  }

  /**
   * Disconnects WebSocket and cleans up state (AC7, AC9, AC10).
   * Call this to actively disconnect. Prevents memory leaks.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.cleanupState();
  }

  /**
   * Cleans up Subject observable state without disconnecting socket.
   * Used by disconnect() and by server-initiated disconnect handler.
   * Note: Sets socket to null defensively in case disconnect() was not called first.
   */
  private cleanupState(): void {
    if (this.eventsSubject) {
      this.eventsSubject.complete();
      this.eventsSubject = undefined;
    }
    // Defensive: ensure socket is null even if disconnect() wasn't called
    if (this.socket) {
      this.socket = null;
    }
  }

  /**
   * Exports test run results as JSON (AC8).
   * GET /api/admin/test-runs/:sessionId/export
   */
  exportResults(sessionId: string): Observable<Blob> {
    return this.http.get(`/api/admin/test-runs/${sessionId}/export`, {
      responseType: 'blob',
    });
  }
}
