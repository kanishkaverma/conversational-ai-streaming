// Type-safe WebSocket message definitions

export interface WSMessage {
  type: string;
  [key: string]: any;
}

// Outgoing messages
export interface ChatMessage extends WSMessage {
  type: 'chat';
  prompt: string;
}

// Incoming messages
export interface ConnectedMessage extends WSMessage {
  type: 'connected';
  clientId: string;
  audioFormat: {
    sampleRate: number;
    channels: number;
    format: string;
  };
}

export interface TextChunkMessage extends WSMessage {
  type: 'text_chunk';
  text: string;
}

export interface TextCompleteMessage extends WSMessage {
  type: 'text_complete';
}

export interface ErrorMessage extends WSMessage {
  type: 'error';
  message: string;
}

export type IncomingMessage = 
  | ConnectedMessage 
  | TextChunkMessage 
  | TextCompleteMessage 
  | ErrorMessage;

export type OutgoingMessage = ChatMessage;

// Chat state types
export interface ChatState {
  isConnected: boolean;
  isStreaming: boolean;
  currentResponse: string;
  error: string | null;
}

// Audio configuration
export const AUDIO_CONFIG = {
  sampleRate: 24000,
  channels: 1,
  format: 'f32le'
} as const;