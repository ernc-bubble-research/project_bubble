import { Test, TestingModule } from '@nestjs/testing';
import { TestRunGateway, TestRunFileStartEvent, TestRunFileCompleteEvent, TestRunCompleteEvent, TestRunErrorEvent } from './test-run.gateway';
import { Server, Socket } from 'socket.io';

describe('[P0] TestRunGateway', () => {
  let gateway: TestRunGateway;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestRunGateway],
    }).compile();

    gateway = module.get<TestRunGateway>(TestRunGateway);

    // Mock Socket.IO server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    gateway.server = mockServer;
  });

  it('[4-7a-UNIT-014] should reject connection with invalid sessionId (non-UUID)', () => {
    // Given: Client with invalid sessionId
    const mockClient = {
      id: 'client-123',
      handshake: { query: { sessionId: 'not-a-uuid' } },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;

    // When: Handle connection
    gateway.handleConnection(mockClient);

    // Then: Client disconnected, not joined to any room
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect(mockClient.join).not.toHaveBeenCalled();
  });

  it('[4-7a-UNIT-015] should reject connection with missing sessionId', () => {
    // Given: Client with no sessionId query param
    const mockClient = {
      id: 'client-123',
      handshake: { query: {} },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;

    // When: Handle connection
    gateway.handleConnection(mockClient);

    // Then: Client disconnected
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect(mockClient.join).not.toHaveBeenCalled();
  });

  it('[4-7a-UNIT-016] should accept valid connection and join client to session room', () => {
    // Given: Client with valid UUID sessionId
    const sessionId = '11111111-0000-0000-0000-000000000001';
    const mockClient = {
      id: 'client-123',
      handshake: { query: { sessionId } },
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;

    // When: Handle connection
    gateway.handleConnection(mockClient);

    // Then: Client joins room, not disconnected
    expect(mockClient.join).toHaveBeenCalledWith('test-run-11111111-0000-0000-0000-000000000001');
    expect(mockClient.disconnect).not.toHaveBeenCalled();
  });

  it('[4-7a-UNIT-017] should emit test-run-file-start event to correct room', () => {
    // Given: File start event
    const event: TestRunFileStartEvent = {
      sessionId: '11111111-0000-0000-0000-000000000001',
      fileIndex: 0,
      fileName: 'document.pdf',
    };

    // When: Emit file start
    gateway.emitFileStart(event);

    // Then: Event sent to session-specific room
    expect(mockServer.to).toHaveBeenCalledWith('test-run-11111111-0000-0000-0000-000000000001');
    expect(mockServer.emit).toHaveBeenCalledWith('test-run-file-start', event);
  });

  it('[4-7a-UNIT-018] should emit test-run-file-complete event with result data', () => {
    // Given: File complete event with LLM response
    const event: TestRunFileCompleteEvent = {
      sessionId: '11111111-0000-0000-0000-000000000001',
      fileIndex: 0,
      fileName: 'document.pdf',
      assembledPrompt: 'Analyze this document...',
      llmResponse: '{"analysis": "complete"}',
      status: 'success',
    };

    // When: Emit file complete
    gateway.emitFileComplete(event);

    // Then: Event sent to session-specific room
    expect(mockServer.to).toHaveBeenCalledWith('test-run-11111111-0000-0000-0000-000000000001');
    expect(mockServer.emit).toHaveBeenCalledWith('test-run-file-complete', event);
  });

  it('[4-7a-UNIT-019] should emit test-run-complete event with summary statistics', () => {
    // Given: Complete event with success/failure counts
    const event: TestRunCompleteEvent = {
      sessionId: '11111111-0000-0000-0000-000000000001',
      totalFiles: 5,
      successCount: 4,
      failedCount: 1,
    };

    // When: Emit complete
    gateway.emitComplete(event);

    // Then: Event sent to session-specific room
    expect(mockServer.to).toHaveBeenCalledWith('test-run-11111111-0000-0000-0000-000000000001');
    expect(mockServer.emit).toHaveBeenCalledWith('test-run-complete', event);
  });

  it('[4-7a-UNIT-020] should emit test-run-error event on failure', () => {
    // Given: Error event
    const event: TestRunErrorEvent = {
      sessionId: '11111111-0000-0000-0000-000000000001',
      errorMessage: 'LLM provider unavailable',
    };

    // When: Emit error
    gateway.emitError(event);

    // Then: Event sent to session-specific room
    expect(mockServer.to).toHaveBeenCalledWith('test-run-11111111-0000-0000-0000-000000000001');
    expect(mockServer.emit).toHaveBeenCalledWith('test-run-error', event);
  });
});
