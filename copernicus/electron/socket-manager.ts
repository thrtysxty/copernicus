import { io, Socket } from 'socket.io-client';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

export class SocketManager {
  private agentsSocket: Socket | null = null;
  private telemetrySocket: Socket | null = null;
  private readonly backendUrl = 'http://localhost:5001';

  constructor() {}

  public connect() {
    if (this.agentsSocket?.connected) return;

    log.info('[SocketManager] Connecting to backend WebSocket...');

    // Agents Namespace
    this.agentsSocket = io(`${this.backendUrl}/agents`, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    // Telemetry Namespace
    this.telemetrySocket = io(`${this.backendUrl}/telemetry`, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    if (!this.agentsSocket || !this.telemetrySocket) return;

    this.agentsSocket.on('connect', () => {
      log.info('[SocketManager] Connected to /agents namespace');
    });

    this.agentsSocket.on('connect_error', (error: Error) => {
      log.error('[SocketManager] /agents connection error:', error.message);
    });

    this.agentsSocket.on('token_stream', (data: { session_id: string, token: string, done: boolean }) => {
      this.broadcast('ws:token-stream', data);
    });

    this.agentsSocket.on('tool_status', (data: { session_id: string, message: string, tool_name?: string }) => {
      this.broadcast('ws:tool-status', data);
    });

    this.telemetrySocket.on('connect', () => {
      log.info('[SocketManager] Connected to /telemetry namespace');
    });

    this.agentsSocket.on('disconnect', (reason: string) => {
      log.warn('[SocketManager] /agents disconnected:', reason);
    });
  }

  public subscribeSession(sessionId: string) {
    if (this.agentsSocket?.connected) {
      this.agentsSocket.emit('subscribe_session', { session_id: sessionId });
      log.info(`[SocketManager] Subscribed to session: ${sessionId}`);
    }
  }

  public unsubscribeSession(sessionId: string) {
    if (this.agentsSocket?.connected) {
      this.agentsSocket.emit('unsubscribe_session', { session_id: sessionId });
      log.info(`[SocketManager] Unsubscribed from session: ${sessionId}`);
    }
  }

  private broadcast(channel: string, data: any) {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    });
  }

  public disconnect() {
    this.agentsSocket?.disconnect();
    this.telemetrySocket?.disconnect();
  }
}

export const socketManager = new SocketManager();
