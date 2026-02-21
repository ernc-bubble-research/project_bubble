import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestRunService } from './test-run.service';
import { AuthService } from './auth.service';
import { io } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('TestRunService', () => {
  let service: TestRunService;
  let httpMock: HttpTestingController;
  let authService: jest.Mocked<AuthService>;
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    (io as jest.MockedFunction<typeof io>).mockReturnValue(mockSocket as any);

    authService = {
      getToken: jest.fn(),
    } as any;

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TestRunService,
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(TestRunService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    jest.clearAllMocks();
  });

  describe('initiateTestRun', () => {
    it('should POST to correct endpoint with payload', () => {
      const templateId = 'template-123';
      const inputs = {
        input1: { type: 'text' as const, text: 'test' },
      };

      service.initiateTestRun(templateId, inputs).subscribe();

      const req = httpMock.expectOne(`/api/admin/workflows/${templateId}/test-run`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ templateId, inputs });
      req.flush({ sessionId: 'session-123' });
    });
  });

  describe('connectWebSocket - UUID validation', () => {
    it('should reject invalid sessionId format', (done) => {
      const invalidSessionId = 'not-a-uuid';
      authService.getToken.mockReturnValue('valid-token');

      service.connectWebSocket(invalidSessionId).subscribe({
        error: (err) => {
          expect(err.message).toBe('Invalid sessionId format');
          done();
        },
      });
    });

    it('should accept valid UUID sessionId', () => {
      const validSessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('valid-token');

      service.connectWebSocket(validSessionId).subscribe();

      expect(io).toHaveBeenCalledWith('/test-runs', {
        query: { sessionId: validSessionId, token: 'valid-token' },
      });
    });
  });

  describe('connectWebSocket - JWT extraction', () => {
    it('should extract JWT token from AuthService', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      const token = 'jwt-token-123';
      authService.getToken.mockReturnValue(token);

      service.connectWebSocket(sessionId).subscribe();

      expect(authService.getToken).toHaveBeenCalled();
      expect(io).toHaveBeenCalledWith('/test-runs', {
        query: { sessionId, token },
      });
    });

    it('should reject if no JWT token available', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue(null);

      service.connectWebSocket(sessionId).subscribe({
        error: (err) => {
          expect(err.message).toBe('No JWT token available');
          done();
        },
      });
    });
  });

  describe('connectWebSocket - event emission', () => {
    it('should emit file-start events', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      service.connectWebSocket(sessionId).subscribe((event) => {
        expect(event.type).toBe('file-start');
        expect(event.data).toEqual({ sessionId: 'test', fileIndex: 0, fileName: 'file.txt' });
        done();
      });

      const fileStartHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test-run-file-start'
      )?.[1];
      fileStartHandler({ sessionId: 'test', fileIndex: 0, fileName: 'file.txt' });
    });

    it('should emit file-complete events', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      service.connectWebSocket(sessionId).subscribe((event) => {
        expect(event.type).toBe('file-complete');
        expect(event.data.sessionId).toBe('test');
        done();
      });

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test-run-file-complete'
      )?.[1];
      handler({ sessionId: 'test', fileIndex: 0, fileName: 'test.txt', assembledPrompt: 'prompt', llmResponse: 'response', status: 'success' });
    });

    it('should emit complete events', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      service.connectWebSocket(sessionId).subscribe((event) => {
        expect(event.type).toBe('complete');
        expect(event.data.totalFiles).toBe(5);
        done();
      });

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test-run-complete'
      )?.[1];
      handler({ sessionId: 'test', totalFiles: 5, successCount: 5, failedCount: 0 });
    });

    it('should emit error events', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      service.connectWebSocket(sessionId).subscribe((event) => {
        expect(event.type).toBe('error');
        expect(event.data.errorMessage).toBe('Test error');
        done();
      });

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'test-run-error'
      )?.[1];
      handler({ sessionId: 'test', errorMessage: 'Test error' });
    });
  });

  describe('disconnect - cleanup', () => {
    it('should disconnect socket and complete Subject', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      const subscription = service.connectWebSocket(sessionId).subscribe();
      service.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect when no socket exists', () => {
      expect(() => service.disconnect()).not.toThrow();
    });
  });

  describe('exportResults', () => {
    it('should GET export endpoint with blob response type', () => {
      const sessionId = 'session-123';

      service.exportResults(sessionId).subscribe();

      const req = httpMock.expectOne(`/api/admin/test-runs/${sessionId}/export`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob());
    });
  });

  describe('WebSocket error handling', () => {
    it('should handle connect_error events', (done) => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      service.connectWebSocket(sessionId).subscribe({
        error: (err) => {
          expect(err.message).toBe('WebSocket connection failed');
          done();
        },
      });

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];
      handler();
    });

    it('should cleanup state on server-initiated disconnect', () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440000';
      authService.getToken.mockReturnValue('token');

      const subscription = service.connectWebSocket(sessionId).subscribe();

      const handler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];
      handler();

      // Should not throw when cleaning up again
      expect(() => service.disconnect()).not.toThrow();
    });
  });
});
