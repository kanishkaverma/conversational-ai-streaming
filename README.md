# Conversational AI Streaming

**Real-time bidirectional text/audio streaming with LLM integration and zero-latency TTS pipeline**

Production-grade system combining WebSocket streaming, multi-modal AI interfaces, and optimized neural TTS.

## Quick Start

### Prerequisites
```bash
Node.js 18+ with Bun runtime
Python 3.12+ with uv package manager  
Apple Silicon Mac (M1/M2/M3) or NVIDIA GPU
OpenAI API key with GPT-4 access
```

### Installation
```bash
git clone https://github.com/kanishkaverma/conversational-ai-streaming
cd conversational-ai-streaming

# Install dependencies
cd server && bun install
cd ../client && bun install  

# Add API key
echo "OPENAI_API_KEY=your_key_here" > server/.env
```

### Run
```bash
# Terminal 1: Start server
cd server && bun run start

# Terminal 2: Start client
cd client && bun run dev
```

**Open**: http://localhost:5173

**First run**: Downloads 1GB TTS model (~10s), then fast startup.

## Architecture

**Data Flow**: User → Browser → WebSocket Server → LLM + TTS → Real-time Audio

```
┌─────────────────┐   WebSocket    ┌──────────────────┐   Child Process   ┌─────────────────┐
│   React Client  │ ◄──JSON/PCM──► │   Bun Server     │ ◄──stdin/stdout──► │   MLX TTS       │
│ • Web Audio API │                │ • LLM Streaming  │                   │ • Neural Synth  │
│ • STT Pipeline  │                │ • Queue Manager  │                   │ • 8-bit Quant   │
│ • PCM Playback  │                │ • Multi-client   │                   │ • PCM Pipeline  │
└─────────────────┘                └──────────────────┘                   └─────────────────┘
```

## Key Features

- **Dual Streaming**: Text appears instantly, voice follows in 1-3 seconds
- **Voice Input**: Hold spacebar for speech-to-text (Parakeet.js + WebGPU)
- **Zero-Copy Audio**: Direct PCM streaming from TTS subprocess to WebSocket
- **Smart Buffering**: 200ms text accumulation for natural speech synthesis
- **Auto-Recovery**: Process restart with exponential backoff (5 attempts)
- **Multi-Client**: Concurrent users with synchronized audio broadcast

## Technical Stack

**Backend**: Bun.js + TypeScript + OpenAI AI SDK + Child Process Management  
**Frontend**: React 19 + Web Audio API + ONNX Runtime Web + WebGPU  
**TTS**: Kyutai Delayed Streams (1.6B params) + MLX + 8-bit quantization  
**Audio**: 24kHz PCM, f32le format, direct stdout streaming

## Core Implementation

**PCM Streaming**:
```python
# Zero-buffering stdout for ultra-low latency
sys.stdout = os.fdopen(sys.stdout.fileno(), 'wb', 0)
pcm_bytes = _pcm.astype('<f4').tobytes()  # Little-endian float32
sys.stdout.write(pcm_bytes)  # Direct binary streaming
```

**WebSocket Binary Protocol**:
```typescript
// Server broadcasts raw PCM to all clients
connectedClients.forEach(client => {
    client.ws.send(pcmData); // ArrayBuffer, no JSON overhead
});
```

**Smart Queue Management**:
```typescript
// 200ms debounce for phrase-level synthesis
this.bufferTimeout = setTimeout(() => {
    this.flushToTTS();
}, 200);
```

## Performance

- **Latency**: Text <100ms, Audio 1-3s, Playback immediate
- **Throughput**: ~96KB/s audio per client, scales to dozens of users  
- **Memory**: 2GB quantized model, efficient queue management
- **Optimization**: 75% memory reduction via 8-bit quantization

## Production Notes

- **Scaling**: nginx WebSocket load balancing + multiple server instances
- **Security**: Environment-based API keys, rate limiting, input validation
- **Monitoring**: Built-in memory/queue tracking, health checks
- **Deployment**: Docker + PM2 + auto-scaling groups

## Troubleshooting

**No audio**: Check browser permissions + WebSocket connection  
**High memory**: Use `--quantize 4` instead of `--quantize 8`  
**Model fails**: Verify internet connection for HuggingFace downloads

## License

MIT License

---

**Built by [Kanishka Verma](mailto:kanisverma@gmail.com)** - Demonstrating real-time AI systems and production WebSocket optimization