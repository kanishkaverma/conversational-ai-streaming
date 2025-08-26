import { useState, useEffect, useRef, useCallback } from 'react';

const useWebSocketChat = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  // Play audio chunk immediately
  const playAudioChunk = useCallback(async (arrayBuffer: ArrayBuffer) => {
    await initAudioContext();
    const audioContext = audioContextRef.current!;

    try {
      // Convert ArrayBuffer to Float32Array (f32le format)
      const pcmData = new Float32Array(arrayBuffer);
      
      // Debug: Check audio data
      const minVal = Math.min(...pcmData);
      const maxVal = Math.max(...pcmData);
      const hasNonZero = pcmData.some(val => Math.abs(val) > 0.001);
      

      // Fix audio issues: DC offset removal and volume boost
      const processedData = new Float32Array(pcmData.length);
      const dcOffset = (minVal + maxVal) / 2; // Calculate DC offset
      const range = Math.max(Math.abs(minVal - dcOffset), Math.abs(maxVal - dcOffset));
      const volumeBoost = range > 0 ? Math.min(0.8 / range, 20) : 1; // Boost to reasonable volume, cap at 20x
      
      for (let i = 0; i < pcmData.length; i++) {
        // Remove DC offset and apply volume boost
        processedData[i] = (pcmData[i] - dcOffset) * volumeBoost;
      }
      
      // console.log(`Audio processing: DC offset: ${dcOffset.toFixed(3)}, volume boost: ${volumeBoost.toFixed(1)}x`);

      if (!hasNonZero) {
        console.warn('⚠️ Audio chunk contains only silence/near-zero values');
      }

      // Create AudioBuffer with processed data
      const audioBuffer = audioContext.createBuffer(1, processedData.length, 24000);
      audioBuffer.copyToChannel(processedData, 0);

      // Create source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // Add to tracking array for cleanup
      audioSourcesRef.current.push(source);

      // Clean up after playback ends
      source.onended = () => {
        const index = audioSourcesRef.current.indexOf(source);
        if (index > -1) {
          audioSourcesRef.current.splice(index, 1);
        }
        // console.log('Audio chunk finished playing');
      };

      // Schedule playback for seamless streaming
      const currentTime = audioContext.currentTime;
      const playTime = Math.max(currentTime, nextPlayTimeRef.current);

      source.start(playTime);
      nextPlayTimeRef.current = playTime + audioBuffer.duration;


    } catch (error) {
      console.error('Audio playback error:', error);
    }
  }, [initAudioContext]);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent) => {
    // Check if binary audio data
    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      // Convert Blob to ArrayBuffer if needed
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(playAudioChunk);
      } else {
        playAudioChunk(event.data);
      }
      return;
    }

    // Handle JSON messages
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'connected':
          console.log('Connected:', data.clientId);
          console.log('Audio format:', data.audioFormat);
          setIsConnected(true);
          setError(null);
          break;

        case 'text_chunk':
          setCurrentResponse(prev => prev + data.text);
          break;

        case 'text_complete':
          setIsStreaming(false);
          console.log('Text streaming complete');
          break;

        case 'error':
          setError(data.message);
          setIsStreaming(false);
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('Failed to parse JSON:', err);
    }
  }, [playAudioChunk]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    wsRef.current = new WebSocket('ws://localhost:3000');

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = handleMessage;

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection failed');
    };
  }, [handleMessage]);

  // Send chat message
  const sendMessage = useCallback(async (prompt: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to server');
      return;
    }

    // Initialize AudioContext with user gesture (required by browsers)
    await initAudioContext();

    // Stop all currently playing audio sources
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already finished, ignore error
      }
    });
    audioSourcesRef.current = [];

    // Reset state for new message
    setCurrentResponse('');
    setIsStreaming(true);
    setError(null);
    
    // Reset timing to current audio context time (not 0)
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    } else {
      nextPlayTimeRef.current = 0;
    }

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      prompt: prompt
    }));
  }, [initAudioContext]);

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    currentResponse,
    isStreaming,
    error,
    sendMessage
  };
};

export default useWebSocketChat;
