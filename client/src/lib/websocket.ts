// WebSocket client with automatic reconnection and type safety

import type { IncomingMessage, OutgoingMessage } from './types';

export interface WebSocketClientConfig {
  url: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketClientConfig>;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers = new Map<string, Set<(data: any) => void>>();
  private binaryHandler: ((data: ArrayBuffer) => void) | null = null;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      url: config.url,
      reconnectDelay: config.reconnectDelay ?? 3000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? Infinity
    };
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.config.url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connection', { connected: true });
    };

    this.ws.onmessage = (event) => {
      // Handle binary audio data
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        if (this.binaryHandler) {
          if (event.data instanceof Blob) {
            event.data.arrayBuffer().then(buffer => {
              this.binaryHandler?.(buffer);
            });
          } else {
            this.binaryHandler(event.data);
          }
        }
        return;
      }

      // Handle JSON messages
      try {
        const message: IncomingMessage = JSON.parse(event.data);
        this.emit(message.type, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.emit('connection', { connected: false });
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', { message: 'Connection failed' });
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, this.config.reconnectDelay);
  }

  send(message: OutgoingMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    this.messageHandlers.get(event)?.delete(handler);
  }

  onBinary(handler: (data: ArrayBuffer) => void): void {
    this.binaryHandler = handler;
  }

  private emit(event: string, data: any): void {
    this.messageHandlers.get(event)?.forEach(handler => handler(data));
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}