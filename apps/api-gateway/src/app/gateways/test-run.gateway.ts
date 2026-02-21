import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { TestRunFileResultDto } from '@project-bubble/shared';

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

/**
 * WebSocket gateway for real-time test run updates.
 * Namespace: /test-runs
 * Room pattern: test-run-${sessionId}
 */
@WebSocketGateway({ namespace: '/test-runs', cors: true })
export class TestRunGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TestRunGateway.name);

  /**
   * Handle new WebSocket connections.
   * Validates sessionId query param and joins client to session-specific room.
   */
  handleConnection(client: Socket): void {
    const sessionId = client.handshake.query.sessionId as string | undefined;

    // Validate sessionId format (AC10)
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      this.logger.warn({
        message: 'WebSocket connection rejected — invalid sessionId',
        sessionId: sessionId || 'missing',
        clientId: client.id,
      });
      client.disconnect();
      return;
    }

    // Join client to session-specific room
    const roomName = `test-run-${sessionId}`;
    client.join(roomName);

    this.logger.log({
      message: 'WebSocket client connected to test run room',
      sessionId,
      roomName,
      clientId: client.id,
    });
  }

  /**
   * Handle client disconnections.
   */
  handleDisconnect(client: Socket): void {
    this.logger.log({
      message: 'WebSocket client disconnected',
      clientId: client.id,
    });
  }

  /**
   * Emit test-run-file-start event to all clients in the session room.
   */
  emitFileStart(event: TestRunFileStartEvent): void {
    const roomName = `test-run-${event.sessionId}`;
    this.server.to(roomName).emit('test-run-file-start', event);
  }

  /**
   * Emit test-run-file-complete event to all clients in the session room.
   */
  emitFileComplete(event: TestRunFileCompleteEvent): void {
    const roomName = `test-run-${event.sessionId}`;
    this.server.to(roomName).emit('test-run-file-complete', event);
  }

  /**
   * Emit test-run-complete event to all clients in the session room.
   */
  emitComplete(event: TestRunCompleteEvent): void {
    const roomName = `test-run-${event.sessionId}`;
    this.server.to(roomName).emit('test-run-complete', event);
  }

  /**
   * Emit test-run-error event to all clients in the session room.
   */
  emitError(event: TestRunErrorEvent): void {
    const roomName = `test-run-${event.sessionId}`;
    this.server.to(roomName).emit('test-run-error', event);
  }
}
