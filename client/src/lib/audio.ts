// Optimized audio utilities for real-time streaming

import { AUDIO_CONFIG } from './types';

export class AudioPlayer {
  private context: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  async init(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate });
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async playChunk(data: ArrayBuffer): Promise<void> {
    await this.init();
    if (!this.context) return;

    try {
      // Convert to Float32Array
      const pcmData = new Float32Array(data);
      
      // Quick validation
      if (pcmData.length === 0) return;
      
      // Create buffer
      const audioBuffer = this.context.createBuffer(
        AUDIO_CONFIG.channels,
        pcmData.length,
        AUDIO_CONFIG.sampleRate
      );
      audioBuffer.copyToChannel(pcmData, 0);

      // Create and configure source
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.context.destination);

      // Track active source
      this.activeSources.push(source);
      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) this.activeSources.splice(index, 1);
      };

      // Schedule seamless playback
      const currentTime = this.context.currentTime;
      const playTime = Math.max(currentTime, this.nextPlayTime);
      source.start(playTime);
      this.nextPlayTime = playTime + audioBuffer.duration;

    } catch (error) {
      console.error('Audio playback error:', error);
    }
  }

  stop(): void {
    // Stop all active sources
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    });
    this.activeSources = [];
    
    // Reset timing
    if (this.context) {
      this.nextPlayTime = this.context.currentTime;
    }
  }

  async close(): Promise<void> {
    this.stop();
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}