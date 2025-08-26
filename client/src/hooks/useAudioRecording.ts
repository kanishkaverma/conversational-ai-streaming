import { useState, useRef, useCallback } from 'react';
import { processRecordedAudio, normalizeAudio } from '../utils/audioUtils';

export interface RecordingState {
  status: 'idle' | 'requesting-permission' | 'ready' | 'recording' | 'processing' | 'error';
  duration: number;
  errorMessage?: string;
}

export const useAudioRecording = () => {
  const [state, setState] = useState<RecordingState>({
    status: 'idle',
    duration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateState = useCallback((updates: Partial<RecordingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (state.status === 'requesting-permission') return false;

    try {
      updateState({ status: 'requesting-permission' });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,  // Request 16kHz if possible
          channelCount: 1,    // Mono
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      
      // Check if browser supports the required MediaRecorder format
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      if (!mimeType) {
        throw new Error('Browser does not support audio recording');
      }

      console.log('Microphone permission granted, using MIME type:', mimeType);
      updateState({ 
        status: 'ready',
        errorMessage: undefined 
      });
      
      return true;
    } catch (error) {
      console.error('Failed to get microphone permission:', error);
      updateState({ 
        status: 'error',
        errorMessage: `Microphone access denied: ${error}`
      });
      return false;
    }
  }, [state.status, updateState]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!streamRef.current) {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) return false;
    }

    if (state.status === 'recording') {
      console.warn('Recording already in progress');
      return false;
    }

    try {
      chunksRef.current = [];
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorderRef.current = new MediaRecorder(streamRef.current!, {
        mimeType,
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        updateState({ 
          status: 'error',
          errorMessage: 'Recording failed'
        });
      };

      // Start recording with data available every 100ms
      mediaRecorderRef.current.start(100);
      startTimeRef.current = Date.now();

      // Update duration every 100ms
      intervalRef.current = setInterval(() => {
        const duration = Date.now() - startTimeRef.current;
        updateState({ duration });
      }, 100);

      updateState({ 
        status: 'recording',
        duration: 0,
        errorMessage: undefined
      });

      console.log('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      updateState({ 
        status: 'error',
        errorMessage: `Failed to start recording: ${error}`
      });
      return false;
    }
  }, [state.status, requestMicrophonePermission, updateState]);

  const stopRecording = useCallback(async (): Promise<Float32Array | null> => {
    if (state.status !== 'recording' || !mediaRecorderRef.current) {
      console.warn('No recording in progress');
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        try {
          updateState({ status: 'processing' });
          
          // Clear the duration update interval
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Create blob from recorded chunks
          const mimeType = mediaRecorder.mimeType;
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          
          console.log(`Processing ${audioBlob.size} bytes of recorded audio`);
          
          // Convert directly to Float32Array PCM at 16kHz - no WAV creation needed!
          const pcmData = await processRecordedAudio(audioBlob);
          console.log(`Processed to ${pcmData.length} PCM samples at 16kHz`);

          // Normalize audio to improve quality
          const normalizedAudio = normalizeAudio(pcmData);

          updateState({ status: 'ready' });
          resolve(normalizedAudio);
        } catch (error) {
          console.error('Failed to process recorded audio:', error);
          updateState({ 
            status: 'error',
            errorMessage: `Failed to process audio: ${error}`
          });
          resolve(null);
        }
      };

      // Stop recording
      mediaRecorder.stop();
      console.log('Recording stopped, processing audio...');
    });
  }, [state.status, updateState]);

  const cleanup = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && state.status === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    updateState({ status: 'idle', duration: 0 });
  }, [state.status, updateState]);

  return {
    state,
    startRecording,
    stopRecording,
    requestMicrophonePermission,
    cleanup,
    isRecording: state.status === 'recording',
    isProcessing: state.status === 'processing',
    hasPermission: state.status !== 'idle' && state.status !== 'requesting-permission',
  };
};