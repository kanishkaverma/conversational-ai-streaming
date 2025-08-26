import { useState, useRef, useCallback } from 'react';
import { ParakeetModel, getParakeetModel } from 'parakeet.js';

export interface TranscriptionState {
  status: 'idle' | 'loading' | 'warming-up' | 'ready' | 'transcribing' | 'error';
  progress: number;
  progressText: string;
  errorMessage?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  duration: number;
  wordCount: number;
}

const REPO_ID = 'istupakov/parakeet-tdt-0.6b-v2-onnx';
const EXPECTED_WARMUP_TEXT = 'it is not life as we know or understand it';

export const useParakeetTranscription = () => {
  const [state, setState] = useState<TranscriptionState>({
    status: 'idle',
    progress: 0,
    progressText: '',
  });

  const modelRef = useRef<ParakeetModel | null>(null);
  const isInitializedRef = useRef(false);

  const updateState = useCallback((updates: Partial<TranscriptionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const initializeModel = useCallback(async () => {
    if (isInitializedRef.current || modelRef.current) {
      console.log('Model already initialized, skipping...');
      return true;
    }

    // Prevent concurrent initializations
    if (initializeModel._initializing) {
      console.log('Model initialization already in progress, waiting...');
      while (initializeModel._initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return isInitializedRef.current;
    }

    initializeModel._initializing = true;

    try {
      updateState({ 
        status: 'loading', 
        progress: 0, 
        progressText: 'Loading Parakeet model...' 
      });

      // Progress callback for model download
      const progressCallback = ({ loaded, total, file }: { loaded: number; total: number; file: string }) => {
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        updateState({
          progress: pct,
          progressText: `${file}: ${pct}%`
        });
      };

      // Download model files from HuggingFace Hub
      console.log('Downloading Parakeet model...');
      const modelUrls = await getParakeetModel(REPO_ID, {
        encoderQuant: 'fp32',    // Required for WebGPU
        decoderQuant: 'int8',    // Optimized for hybrid mode
        preprocessor: 'nemo128',
        progress: progressCallback
      });

      updateState({ 
        status: 'loading',
        progressText: 'Creating model sessions...',
        progress: 0
      });

      // Create model instance with fallback
      console.log('Creating Parakeet model instance...');
      let backend = 'webgpu-hybrid';
      let modelInstance = null;
      
      try {
        modelInstance = await ParakeetModel.fromUrls({
          ...modelUrls.urls,
          filenames: modelUrls.filenames,
          backend: 'webgpu-hybrid', // Best performance: encoder on GPU, decoder on CPU
          verbose: false,
          cpuThreads: Math.max(1, navigator.hardwareConcurrency - 2),
        });
        console.log('Model created successfully with WebGPU backend');
      } catch (webgpuError) {
        console.warn('WebGPU backend failed, falling back to WASM:', webgpuError);
        backend = 'wasm';
        
        updateState({
          progressText: 'WebGPU failed, using WASM backend...'
        });
        
        modelInstance = await ParakeetModel.fromUrls({
          ...modelUrls.urls,
          filenames: modelUrls.filenames,
          backend: 'wasm',
          verbose: false,
          cpuThreads: Math.max(1, navigator.hardwareConcurrency - 2),
        });
        console.log('Model created successfully with WASM backend');
      }
      
      modelRef.current = modelInstance;

      // Warm-up and verification
      updateState({ 
        status: 'warming-up',
        progressText: 'Warming up model (first-time compilation)...'
      });

      console.log('Starting warm-up transcription...');
      try {
        const audioRes = await fetch('/warmup-audio.wav');
        if (!audioRes.ok) {
          throw new Error('Failed to load warm-up audio file');
        }

        // Use the same pattern as the react example for more reliable decoding
        const buf = await audioRes.arrayBuffer();
        let audioCtx = null;
        let pcm = null;
        
        try {
          audioCtx = new AudioContext({ sampleRate: 16000 });
          const decoded = await audioCtx.decodeAudioData(buf);
          pcm = decoded.getChannelData(0);
        } finally {
          if (audioCtx) {
            await audioCtx.close();
          }
        }
        
        if (!pcm || pcm.length === 0) {
          throw new Error('Failed to decode audio data - no PCM data produced');
        }
        
        console.log(`Warm-up audio loaded: ${pcm.length} samples at 16kHz`);

        const { utterance_text } = await modelRef.current.transcribe(pcm, 16000);
        console.log('Warm-up transcription result:', utterance_text);

        // Verify against expected text (normalize for comparison)
        const normalize = (str: string) => str.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
        const normalizedResult = normalize(utterance_text);
        const normalizedExpected = normalize(EXPECTED_WARMUP_TEXT);

        if (normalizedResult.includes(normalizedExpected)) {
          console.log('Model verification successful!');
          updateState({ 
            status: 'ready',
            progressText: `Model ready (${backend} backend)`,
            errorMessage: undefined
          });
          isInitializedRef.current = true;
          return true;
        } else {
          console.warn(`Model verification failed. Expected: "${EXPECTED_WARMUP_TEXT}", Got: "${utterance_text}"`);
          // Still mark as ready since the model is working, just verification failed
          updateState({ 
            status: 'ready',
            progressText: `Model ready (${backend} backend, verification warning)`,
            errorMessage: undefined
          });
          isInitializedRef.current = true;
          return true;
        }
      } catch (warmupError) {
        console.error('Warm-up transcription failed:', warmupError);
        
        // If warm-up fails but model was created, still try to mark as ready
        if (modelRef.current) {
          console.warn('Warm-up failed but model exists, marking as ready anyway');
          updateState({ 
            status: 'ready',
            progressText: `Model ready (${backend} backend, warm-up skipped)`,
            errorMessage: `Warm-up failed: ${warmupError.message}`
          });
          isInitializedRef.current = true;
          return true;
        }
        
        throw new Error(`Model warm-up failed: ${warmupError}`);
      }

    } catch (error) {
      console.error('Failed to initialize Parakeet model:', error);
      updateState({ 
        status: 'error',
        errorMessage: `Initialization failed: ${error}`,
        progressText: ''
      });
      return false;
    } finally {
      initializeModel._initializing = false;
    }
  }, [updateState]);

  const transcribe = useCallback(async (audioData: Float32Array): Promise<TranscriptionResult | null> => {
    if (!modelRef.current) {
      const initialized = await initializeModel();
      if (!initialized) return null;
    }

    if (state.status === 'transcribing') {
      console.warn('Transcription already in progress');
      return null;
    }

    try {
      updateState({ 
        status: 'transcribing',
        progressText: 'Transcribing audio...'
      });

      console.log(`Starting transcription of ${audioData.length} samples`);
      const startTime = performance.now();

      const result = await modelRef.current!.transcribe(audioData, 16000, {
        returnTimestamps: true,
        returnConfidences: true,
        frameStride: 1 // Best accuracy
      });

      const duration = performance.now() - startTime;
      
      console.log('Transcription complete:', {
        text: result.utterance_text,
        duration: `${duration.toFixed(0)}ms`,
        rtf: result.metrics?.rtf
      });

      updateState({ 
        status: 'ready',
        progressText: 'Transcription complete'
      });

      return {
        text: result.utterance_text,
        confidence: result.confidence_scores?.token_avg ?? result.confidence_scores?.word_avg,
        duration,
        wordCount: result.words?.length || result.utterance_text.split(/\s+/).length,
      };

    } catch (error) {
      console.error('Transcription failed:', error);
      updateState({ 
        status: 'error',
        errorMessage: `Transcription failed: ${error}`,
        progressText: ''
      });
      return null;
    }
  }, [state.status, initializeModel, updateState]);

  return {
    state,
    initializeModel,
    transcribe,
    isReady: state.status === 'ready',
  };
};