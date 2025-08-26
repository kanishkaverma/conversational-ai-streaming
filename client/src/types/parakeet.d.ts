declare module 'parakeet.js' {
  export interface TranscriptionResult {
    utterance_text: string;
    confidence_scores?: {
      token_avg?: number;
      word_avg?: number;
    };
    words?: Array<{
      word: string;
      start_time: number;
      end_time: number;
      confidence: number;
    }>;
    timestamps?: Array<[number, number]>;
    metrics?: {
      rtf?: number;
      total_ms: number;
      preprocess_ms: number;
      encode_ms: number;
      decode_ms: number;
      tokenize_ms: number;
    };
  }

  export interface ModelOptions {
    backend?: 'webgpu-hybrid' | 'webgpu-strict' | 'wasm';
    verbose?: boolean;
    cpuThreads?: number;
  }

  export interface TranscribeOptions {
    returnTimestamps?: boolean;
    returnConfidences?: boolean;
    frameStride?: number;
  }

  export interface ModelUrls {
    urls: Record<string, string>;
    filenames: Record<string, string>;
  }

  export interface GetModelOptions {
    encoderQuant?: 'fp32' | 'int8';
    decoderQuant?: 'fp32' | 'int8';
    preprocessor?: string;
    progress?: (info: { loaded: number; total: number; file: string }) => void;
  }

  export class ParakeetModel {
    static fromUrls(options: ModelUrls & ModelOptions): Promise<ParakeetModel>;
    
    transcribe(
      audio: Float32Array,
      sampleRate: number,
      options?: TranscribeOptions
    ): Promise<TranscriptionResult>;
  }

  export function getParakeetModel(
    repoId: string,
    options?: GetModelOptions
  ): Promise<ModelUrls>;
}