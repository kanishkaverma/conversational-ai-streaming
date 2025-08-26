import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { spawn, type ChildProcess } from 'child_process';

type WebSocketClient = { ws: any; id: string };

class TTSQueue {
  private queue: string[] = [];
  private buffer = '';
  private timeout: NodeJS.Timeout | null = null;
  
  add = (text: string) => {
    this.buffer += text;
    this.timeout && clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.flush(), 200);
  }
  
  flush = () => {
    if (this.buffer.trim()) {
      this.queue.push(this.buffer.trim());
      this.buffer = '';
    }
    this.timeout && clearTimeout(this.timeout);
    this.timeout = null;
  }
  
  next = () => this.queue.shift() || null;
  isEmpty = () => !this.queue.length;
  size = () => this.queue.length;
  clear = () => { 
    this.flush();
    this.queue = [];
  }
}

const ttsQueue = new TTSQueue();
const clients = new Set<WebSocketClient>();
let ttsProcess: ChildProcess | null = null;
let restarts = 0;

const broadcast = (data: any, onError?: (client: WebSocketClient) => void) => {
  clients.forEach(client => {
    try { client.ws.send(data); } 
    catch { onError?.(client) || clients.delete(client); }
  });
};

const startTTS = (): ChildProcess => {
  console.log('Starting TTS process...');
  const proc = spawn('uv', ['run', '../scripts/tts_mlx_streaming.py', '--quantize', '8', 'stdout'], 
    { stdio: ['pipe', 'pipe', 'pipe'], cwd: process.cwd() });
  
  proc.stderr?.on('data', data => console.log(`TTS Log: ${data}`));
  proc.stdout?.on('data', (pcm: Buffer) => broadcast(pcm));
  proc.on('error', err => { console.error('TTS Error:', err); restartTTS(); });
  proc.on('exit', code => code && restartTTS());
  
  return proc;
};

const restartTTS = () => {
  if (restarts++ < 5) {
    console.log(`Restarting TTS (${restarts}/5)...`);
    setTimeout(() => { ttsProcess = startTTS(); }, 1000);
  } else {
    console.error('TTS crashed too many times');
    broadcast(JSON.stringify({ type: 'error', message: 'TTS unavailable' }));
  }
};

ttsProcess = startTTS();

const server = Bun.serve({
  port: 3000,
  fetch: (req, srv) => srv.upgrade(req) ? undefined : new Response("WebSocket required", { status: 400 }),
  websocket: {
    async message(ws, msg) {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'chat' && data.prompt) {
          console.log('Chat:', data.prompt);
          ttsQueue.clear();
          
          const result = streamText({
            model: openai('gpt-4.1-mini-2025-04-14'),
            system: 'You are a helpful assistant. keep everything super short. never use em dashes. think deeply before answering.',
            prompt: data.prompt,
          });

          console.log('Starting text stream...');
          let chunkCount = 0;
          for await (const text of result.textStream) {
            chunkCount++;
            console.log(`Chunk ${chunkCount}: "${text}"`);
            ws.send(JSON.stringify({ type: 'text_chunk', text }));
            ttsQueue.add(text);
          }
          
          console.log(`Text streaming complete. Total chunks: ${chunkCount}`);
          ttsQueue.flush();
          ws.send(JSON.stringify({ type: 'text_complete' }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid format' }));
        }
      } catch (error) {
        console.error('Error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Failed to process' }));
      }
    },
    open(ws) {
      const id = Math.random().toString(36).substring(7);
      const client = { ws, id };
      clients.add(client);
      console.log(`Client ${id} connected. Total: ${clients.size}`);
      
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Ready',
        clientId: id,
        audioFormat: {
          format: 'f32le',
          sampleRate: 24000,
          channels: 1,
          bitDepth: 32,
          encoding: 'float32',
          byteOrder: 'little-endian',
          range: '[-1.0, +1.0]',
          note: 'Raw PCM binary'
        }
      }));
    },
    close(ws) {
      const client = [...clients].find(c => c.ws === ws);
      if (client) {
        clients.delete(client);
        console.log(`Client ${client.id} disconnected. Total: ${clients.size}`);
      }
    },
  },
});

(async () => {
  let counter = 0;
  while (true) {
    if (!ttsQueue.isEmpty() && ttsProcess?.stdin) {
      const text = ttsQueue.next();
      if (text) {
        console.log(`TTS: "${text}"`);
        try { ttsProcess.stdin.write(text + '\n'); } 
        catch (e) { console.error('TTS write failed:', e); restartTTS(); }
      }
    }
    
    if (++counter >= 200) {
      const m = process.memoryUsage();
      console.log(`Queue: ${ttsQueue.size()}, RSS: ${Math.round(m.rss/1048576)}MB, Heap: ${Math.round(m.heapUsed/1048576)}MB`);
      counter = 0;
    }
    
    await new Promise(r => setTimeout(r, 50));
  }
})();

console.log(`Server: ws://localhost:${server.port}`);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ttsProcess?.kill('SIGTERM');
  clients.forEach(c => c.ws.close());
  process.exit(0);
});