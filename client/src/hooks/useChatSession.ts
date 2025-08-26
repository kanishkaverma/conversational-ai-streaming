// Consolidated hook for managing chat session state and WebSocket communication

import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketClient } from '../lib/websocket';
import { AudioPlayer } from '../lib/audio';
import type { ChatState, TextChunkMessage, TextCompleteMessage, ErrorMessage, ConnectedMessage } from '../lib/types';

const WS_URL = 'ws://localhost:3000';

export function useChatSession() {
  const [state, setState] = useState<ChatState>({
    isConnected: false,
    isStreaming: false,
    currentResponse: '',
    error: null
  });

  const wsClientRef = useRef<WebSocketClient | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  // Initialize WebSocket and audio on mount
  useEffect(() => {
    const wsClient = new WebSocketClient({ url: WS_URL });
    const audioPlayer = new AudioPlayer();

    wsClientRef.current = wsClient;
    audioPlayerRef.current = audioPlayer;

    // Set up event handlers
    wsClient.on('connection', ({ connected }: { connected: boolean }) => {
      setState(prev => ({ ...prev, isConnected: connected, error: null }));
    });

    wsClient.on('connected', (data: ConnectedMessage) => {
      console.log('Connected with client ID:', data.clientId);
      setState(prev => ({ ...prev, isConnected: true }));
    });

    wsClient.on('text_chunk', (data: TextChunkMessage) => {
      setState(prev => ({ ...prev, currentResponse: prev.currentResponse + data.text }));
    });

    wsClient.on('text_complete', (_data: TextCompleteMessage) => {
      setState(prev => ({ ...prev, isStreaming: false }));
      console.log('Text streaming complete');
    });

    wsClient.on('error', (data: ErrorMessage) => {
      setState(prev => ({ 
        ...prev, 
        error: data.message, 
        isStreaming: false 
      }));
    });

    // Handle binary audio data
    wsClient.onBinary(async (data: ArrayBuffer) => {
      await audioPlayer.playChunk(data);
    });

    // Connect
    wsClient.connect();

    // Cleanup
    return () => {
      wsClient.disconnect();
      audioPlayer.close();
    };
  }, []);

  // Send message to server
  const sendMessage = useCallback(async (prompt: string) => {
    const wsClient = wsClientRef.current;
    const audioPlayer = audioPlayerRef.current;

    if (!wsClient?.isConnected) {
      setState(prev => ({ ...prev, error: 'Not connected to server' }));
      return;
    }

    // Initialize audio context (requires user gesture)
    await audioPlayer?.init();

    // Stop any playing audio
    audioPlayer?.stop();

    // Reset state for new message
    setState(prev => ({
      ...prev,
      currentResponse: '',
      isStreaming: true,
      error: null
    }));

    try {
      wsClient.send({ type: 'chat', prompt });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to send message',
        isStreaming: false
      }));
    }
  }, []);

  return {
    ...state,
    sendMessage
  };
}