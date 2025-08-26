import { openai } from '@ai-sdk/openai';

import { streamText } from 'ai';
import { spawn, type ChildProcess } from 'child_process';

interface TTSQueueItem {
  id: string;
  text: string;
  timestamp: number;
  processed: boolean;
}

interface WebSocketClient {
  ws: any;
  id: string;
}

class TTSQueue {
  private queue: TTSQueueItem[] = [];
  private textBuffer: string = '';
  private bufferTimeout: NodeJS.Timeout | null = null;
  
  add(text: string): string {
    const id = Math.random().toString(36).substring(7);
    
    // Buffer small chunks to create more natural speech units
    this.textBuffer += text;
    
    // Clear existing timeout
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
    }
    
    // Set new timeout to flush buffer
    this.bufferTimeout = setTimeout(() => {
      if (this.textBuffer.trim()) {
        this.queue.push({
          id: Math.random().toString(36).substring(7),
          text: this.textBuffer.trim(),
          timestamp: Date.now(),
          processed: false
        });
        this.textBuffer = '';
      }
    }, 200); // 200ms buffer to collect chunks
    
    return id;
  }
  
  flushBuffer(): void {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    if (this.textBuffer.trim()) {
      this.queue.push({
        id: Math.random().toString(36).substring(7),
        text: this.textBuffer.trim(),
        timestamp: Date.now(),
        processed: false
      });
      this.textBuffer = '';
    }
  }
  
  getNext(): TTSQueueItem | null {
    const index = this.queue.findIndex(item => !item.processed);
    if (index !== -1) {
      const item = this.queue[index];
      this.queue.splice(index, 1);  // Actually remove the item from memory
      return item;
    }
    return null;
  }
  
  isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  size(): number {
    return this.queue.length;
  }
  
  clear(): void {
    // Clear the buffer and timeout
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
      this.bufferTimeout = null;
    }
    this.textBuffer = '';
    
    // Actually clear the queue array
    this.queue = [];
  }
}

const ttsQueue = new TTSQueue();
const connectedClients: Set<WebSocketClient> = new Set();
let ttsProcess: ChildProcess | null = null;
let processRestartCount = 0;
const MAX_RESTART_ATTEMPTS = 5;


// TTS Process Management
function startTTSProcess(): ChildProcess {
  console.log('Starting TTS process...');
  const process = spawn('uv', ['run', 'scripts/tts_mlx_streaming.py', '--quantize', '6', 'stdout'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });
  
  process.stderr?.on('data', (data) => {
    console.log(`TTS Log: ${data.toString()}`);
  });
  
  process.on('error', (error) => {
    console.error('TTS Process Error:', error);
    handleTTSProcessCrash();
  });
  
  process.on('exit', (code) => {
    console.log(`TTS process exited with code ${code}`);
    if (code !== 0) {
      handleTTSProcessCrash();
    }
  });
  
  // Handle PCM data from stdout
  process.stdout?.on('data', (pcmData: Buffer) => {
    // Broadcast PCM data to all connected clients
    broadcastAudioChunk(pcmData);
  });
  
  return process;
}


function handleTTSProcessCrash(): void {
  if (processRestartCount < MAX_RESTART_ATTEMPTS) {
    processRestartCount++;
    console.log(`TTS process crashed (attempt ${processRestartCount}/${MAX_RESTART_ATTEMPTS})`);
    console.log('Restarting TTS process after crash...');
    setTimeout(() => {
      ttsProcess = startTTSProcess();
    }, 1000);
  } else {
    console.error('TTS process crashed too many times, giving up');
    broadcastError('TTS service unavailable');
  }
}

function broadcastAudioChunk(pcmData: Buffer): void {
  // Send raw PCM binary data directly to WebSocket clients
  // PCM format: f32le (32-bit float, little-endian), 24kHz, mono
  connectedClients.forEach(client => {
    try {
      // Send binary PCM data directly
      client.ws.send(pcmData);
    } catch (error) {
      console.error('Failed to send audio to client:', error);
      connectedClients.delete(client);
    }
  });
}

function broadcastError(message: string): void {
  const errorMessage = JSON.stringify({
    type: 'error',
    message
  });
  
  connectedClients.forEach(client => {
    try {
      client.ws.send(errorMessage);
    } catch (error) {
      connectedClients.delete(client);
    }
  });
}

// Initialize TTS process
ttsProcess = startTTSProcess();

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("WebSocket upgrade required", { status: 400 });
  },
  websocket: {
    async message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'chat' && data.prompt) {
          console.log('Received chat message:', data.prompt);
          
          // Clear any remaining TTS queue from previous message
          ttsQueue.clear();
          console.log('Cleared TTS queue for new message');
          
          const result = streamText({
            model: openai('gpt-4.1-mini-2025-04-14'),
            system: 'You are a helpful assistant. keep everything super short. never use em dashes. think deeply before answering.',
            prompt: data.prompt,
          });

          // Stream text back to UI and add to TTS queue
          for await (const textPart of result.textStream) {
            // Send to UI
            ws.send(JSON.stringify({
              type: 'text_chunk',
              text: textPart
            }));
            
            // Add to TTS queue for audio generation
            ttsQueue.add(textPart);
          }
          
          // Flush any remaining text in buffer and signal completion
          ttsQueue.flushBuffer();
          ws.send(JSON.stringify({
            type: 'text_complete'
          }));
          
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    },
    open(ws) {
      const clientId = Math.random().toString(36).substring(7);
      const client: WebSocketClient = { ws, id: clientId };
      connectedClients.add(client);
      
      console.log(`WebSocket connection opened (${clientId}). Active clients: ${connectedClients.size}`);
      
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Ready for chat and audio streaming',
        clientId,
        audioFormat: {
          format: 'f32le',
          sampleRate: 24000,
          channels: 1,
          bitDepth: 32,
          encoding: 'float32',
          byteOrder: 'little-endian',
          range: '[-1.0, +1.0]',
          note: 'Audio data is sent as raw binary PCM frames, not JSON'
        }
      }));
    },
    close(ws) {
      // Remove client from connected clients
      for (const client of connectedClients) {
        if (client.ws === ws) {
          connectedClients.delete(client);
          console.log(`WebSocket connection closed (${client.id}). Active clients: ${connectedClients.size}`);
          break;
        }
      }
    },
  },
});

// Memory monitoring function
function logMemoryStats(): void {
  const memUsage = process.memoryUsage();
  console.log(`Memory Stats - Queue: ${ttsQueue.size()} items, RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

// TTS processing loop - sends text to TTS process
async function processTTSQueue() {
  let memoryLogCounter = 0;
  
  while (true) {
    if (!ttsQueue.isEmpty() && ttsProcess && ttsProcess.stdin) {
      const item = ttsQueue.getNext();
      if (item) {
        console.log(`Processing TTS for: "${item.text}"`);
        try {
          // Send text to TTS process
          ttsProcess.stdin.write(item.text + '\n');
        } catch (error) {
          console.error('Failed to write to TTS process:', error);
          handleTTSProcessCrash();
        }
      }
    }
    
    // Log memory stats every 10 seconds (200 cycles * 50ms)
    memoryLogCounter++;
    if (memoryLogCounter >= 200) {
      logMemoryStats();
      memoryLogCounter = 0;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50)); // Check every 50ms for responsiveness
  }
}

// Start TTS processing
processTTSQueue();

console.log(`Unified server running on ws://localhost:${server.port}`);
console.log('TTS streaming enabled - clients will receive both text and audio');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  
  // Close TTS process
  if (ttsProcess) {
    ttsProcess.kill('SIGTERM');
  }
  
  // Close all WebSocket connections
  connectedClients.forEach(client => {
    client.ws.close();
  });
  
  process.exit(0);
});