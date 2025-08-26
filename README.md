# Conversational AI Streaming

**Chat with AI using both text and voice at the same time**

Connect any LLM to realistic TTS technology for natural conversations.

## What This Does

Talk to AI and hear it talk back by putting together:
- **Any LLM** (like ChatGPT) to give smart responses
- **TTS technology** that sounds like a real person
- **Real-time streaming** so you see text instantly and hear voice fast
- **Web interface** where you can type or speak your questions

## How It Works

```
YOU TYPE/SPEAK → BROWSER → SERVER → LLM → TTS ENGINE → SPEAKERS
```

1. You type or speak into the web page
2. Server asks ChatGPT for a response
3. Text streams to your screen immediately
4. Same text goes to TTS engine for voice generation
5. You see text and hear voice at the same time

## Quick Setup

### What You Need
- **Node.js 18+** and **Bun**
- **Python 3.12+** with **uv**
- **Mac with Apple Silicon** or **NVIDIA GPU**
- **OpenAI API key**

### Installation
```bash
git clone https://github.com/kanishkaverma/conversational-ai-streaming
cd conversational-ai-streaming

# Install server
cd server && bun install

# Install client (use bun or npm)
cd ../client && bun install

# Add your API key
echo "OPENAI_API_KEY=your_key_here" > server/.env
```

### Run It
```bash
# Terminal 1 - Start server
cd server && bun run start

# Terminal 2 - Start web page  
cd client && bun run dev
```

Open http://localhost:5173 in your browser.

**First time**: Downloads 1GB voice model, takes 5-10 seconds. Then it's fast.

**Note**: The TTS script (`scripts/tts_mlx_streaming.py`) is self-contained with inline dependencies. When you run it with `uv run`, it automatically installs the required Python packages (`moshi_mlx`, `huggingface_hub`, etc.) without needing the original delayed-streams-modeling repository.

## Project Structure

```
conversational-ai-streaming/
├── server/                      # Bun WebSocket server + LLM integration
├── client/                      # React frontend with speech-to-text
└── scripts/tts_mlx_streaming.py # Kyutai TTS with MLX optimization
```

## Key Features

- **Real-time streaming**: Text appears instantly, voice follows in 1-3 seconds
- **Voice input**: Hold spacebar to record, automatic speech-to-text
- **Multi-client**: Multiple people can chat simultaneously
- **Apple optimized**: 8-bit quantization for 3x speed on Mac
- **Auto-recovery**: Handles crashes and restarts automatically

## Technical Details

- **Server**: Bun + TypeScript + WebSockets + OpenAI API
- **Client**: React + Web Audio API + Parakeet.js (STT)
- **TTS**: Kyutai Delayed Streams Modeling with MLX
- **Audio**: 24kHz PCM streaming, f32le format
- **Optimization**: 8-bit quantization, direct stdout streaming

## Common Issues

**No sound**: Check browser audio permissions and connection status  
**High memory**: Change `--quantize 8` to `--quantize 4` in server code  
**TTS fails**: Check internet connection for model download  
**Python deps**: If `uv run` fails, try `pip install -r requirements.txt` first  

## License

MIT License

---

**Built by [Kanishka Verma](mailto:kanisverma@gmail.com)**