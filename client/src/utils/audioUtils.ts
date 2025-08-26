// Audio utilities for microphone recording and PCM processing

/**
 * Decodes audio from a response/blob to PCM Float32Array at 16kHz mono
 */
export async function decodeAudio(audioData: Response | Blob): Promise<Float32Array> {
  let arrayBuffer: ArrayBuffer;
  
  if (audioData instanceof Response) {
    arrayBuffer = await audioData.arrayBuffer();
  } else {
    arrayBuffer = await audioData.arrayBuffer();
  }

  // Create AudioContext with target sample rate
  const audioContext = new AudioContext({ sampleRate: 16000 });
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to mono if stereo
    let pcmData: Float32Array;
    if (audioBuffer.numberOfChannels > 1) {
      // Mix down to mono
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);
      pcmData = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        pcmData[i] = (leftChannel[i] + rightChannel[i]) / 2;
      }
    } else {
      pcmData = audioBuffer.getChannelData(0);
    }

    // Resample to 16kHz if needed
    if (audioBuffer.sampleRate !== 16000) {
      pcmData = await resampleAudio(pcmData, audioBuffer.sampleRate, 16000);
    }

    await audioContext.close();
    return pcmData;
  } catch (error) {
    await audioContext.close();
    throw new Error(`Failed to decode audio: ${error}`);
  }
}

/**
 * Simple linear resampling (for more complex use cases, consider using a dedicated library)
 */
async function resampleAudio(inputData: Float32Array, inputSampleRate: number, outputSampleRate: number): Promise<Float32Array> {
  if (inputSampleRate === outputSampleRate) {
    return inputData;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(inputData.length / ratio);
  const outputData = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const inputIndex = i * ratio;
    const inputIndexFloor = Math.floor(inputIndex);
    const inputIndexCeil = Math.min(inputIndexFloor + 1, inputData.length - 1);
    const fraction = inputIndex - inputIndexFloor;

    // Linear interpolation
    outputData[i] = inputData[inputIndexFloor] * (1 - fraction) + inputData[inputIndexCeil] * fraction;
  }

  return outputData;
}

/**
 * Converts MediaRecorder blob to Float32Array PCM at 16kHz
 */
export async function processRecordedAudio(blob: Blob): Promise<Float32Array> {
  return await decodeAudio(blob);
}

/**
 * Normalizes audio data to prevent clipping and improve quality
 */
export function normalizeAudio(pcmData: Float32Array): Float32Array {
  let maxValue = 0;
  for (let i = 0; i < pcmData.length; i++) {
    const absValue = Math.abs(pcmData[i]);
    if (absValue > maxValue) {
      maxValue = absValue;
    }
  }
  if (maxValue === 0) return pcmData;
  
  const normalized = new Float32Array(pcmData.length);
  const scale = 0.95 / maxValue; // Leave some headroom
  
  for (let i = 0; i < pcmData.length; i++) {
    normalized[i] = pcmData[i] * scale;
  }
  
  return normalized;
}