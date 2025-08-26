# Conversational AI Streaming

**Chat with AI using both text and voice at the same time**

Connect any AI chatbot to realistic voice technology for natural conversations.

## What This Does

This project lets you **talk to AI and hear it talk back** by putting together:
- **Any AI chatbot** (like ChatGPT) to give smart responses
- **Voice technology** that sounds like a real person
- **Real-time streaming** so you see text instantly and hear voice fast
- **Web interface** where you can type or speak your questions

## How It Works

```
YOU TYPE/SPEAK → WEB PAGE → SERVER → AI BRAIN → VOICE MAKER → SPEAKER
    ↑              ↓         ↓        ↓          ↓           ↓
 Your Device    Browser   Computer   ChatGPT   Text-to-Voice  You Hear
```

**Step by step:**
1. You type a message or speak into your microphone
2. Your browser sends it to the server computer
3. Server asks ChatGPT (or other AI) for a response
4. AI sends back text, word by word
5. Text goes to you instantly, and also goes to voice maker
6. Voice maker turns text into realistic speech
7. You see the text and hear the voice at the same time

## Quick Start

### What You Need

- **Node.js 18+** and **Bun** (JavaScript tools)
- **Python 3.12+** with **uv** (Python tools)
- **Mac with Apple Silicon** (M1, M2, M3 chips) or **NVIDIA GPU**
- **OpenAI API key** (costs about $0.01 per conversation)

### Setup Steps

1. **Download the code**:
```bash
git clone <your-repo-url> conversational-ai-streaming
cd conversational-ai-streaming
```

2. **Install the parts**:
```bash
# Install server parts
cd server
bun install

# Install web page parts  
cd ../client
npm install

# Python voice parts install automatically when first used
```

3. **Add your API key**:
```bash
# Put your OpenAI key in the server folder
echo "OPENAI_API_KEY=your_openai_api_key_here" > server/.env
```

### Start It Up

**First terminal window (start the brain)**:
```bash
cd server
bun run start
# This starts the server at ws://localhost:3000
```

**Second terminal window (start the web page)**:
```bash
cd client  
npm run dev
# This opens a web page at http://localhost:5173
```

**First time setup**: The first message takes 5-10 seconds because it downloads the voice AI model (about 1GB). After that, messages are much faster.

## What Files Do What

```
conversational-ai-streaming/
├── README.md                    # Instructions (this file)
├── server/                      # The brain that connects everything
│   ├── package.json             # List of tools needed
│   └── unified-server.ts        # Main program that runs the server
├── client/                      # The web page you see and use
│   ├── package.json             # List of web tools needed
│   ├── src/
│   │   ├── components/
│   │   │   └── ChatInterface.tsx # The main chat window
│   │   └── hooks/
│   │       ├── useWebSocketChat.ts      # Handles talking to server + audio
│   │       ├── useAudioRecording.ts     # Records your voice
│   │       └── useParakeetTranscription.ts # Turns your speech to text
│   └── ...                      # Config files and other web stuff
└── scripts/
    └── tts_mlx_streaming.py     # The voice generator (text to speech)
```

## More Details on How It Works

### What Happens When You Send a Message

1. **You type or speak** → Hold spacebar to record voice, or just type
2. **Message goes to server** → Your browser sends your message 
3. **Server asks AI** → Server sends your message to ChatGPT
4. **AI responds with streaming text** → ChatGPT sends back words one by one
5. **Two things happen at once**:
   - **Text goes to your screen** → You see words appear right away
   - **Text goes to voice maker** → Words get collected for voice generation
6. **Voice maker creates audio** → Python program turns text into speech sounds
7. **Audio streams to your speakers** → You hear the voice speaking the response

### How the Voice Part Works

The server starts a Python program that runs in the background:
```bash
uv run scripts/tts_mlx_streaming.py --quantize 8 stdout
```

**How it's made fast**:
- **8-bit mode**: Uses less computer memory, runs 3x faster on Mac
- **Direct streaming**: Audio goes straight to your speakers with no delays
- **Smart text grouping**: Waits 200ms to group words into natural phrases
- **Auto-restart**: If the voice program crashes, it restarts itself up to 5 times

### How Your Browser Talks to the Server

**When you send a message**:
```json
{"type": "chat", "prompt": "your message"}
```

**What the server sends back**:
```json
{"type": "text_chunk", "text": "part of response"}
{"type": "text_complete"}  
{"type": "connected", "clientId": "abc123", "audioFormat": {...}}
{"type": "error", "message": "something went wrong"}
```

**Audio data**: The voice audio is sent as raw binary data, separate from the text messages.

## Changing Settings

### Server Settings

Edit `server/unified-server.ts` to change:

```typescript
// Which AI to use
model: openai('gpt-4.1-mini-2025-04-14'),  // Try different models

// How AI should act
system: 'You are a helpful assistant...',   // Change AI personality

// Voice quality vs speed  
['--quantize', '8']  // Lower numbers = better quality but slower (4, 6, 8)

// How long to wait before speaking
setTimeout(() => {...}, 200);  // Change 200 to wait longer/shorter (milliseconds)
```

### Web Page Settings

The web page automatically works with whatever the server sends. To change things:
- `useWebSocketChat.ts` - Change server address, audio handling
- `ChatInterface.tsx` - Change how buttons work, add shortcuts
- Audio is always 24kHz to match the voice generator

## For Developers

### Working on the Server
```bash
cd server
bun run dev  # Restarts automatically when you change code
```

### Working on the Web Page  
```bash
cd client
npm run dev    # Live preview as you edit
npm run build  # Make final version for deployment
npm run lint   # Check for code problems
```

### Testing the Voice Generator
You can test the voice part by itself:
```bash
# Save voice to a file
echo "Hello world" | uv run scripts/tts_mlx_streaming.py output.wav

# Play voice through speakers
echo "Hello world" | uv run scripts/tts_mlx_streaming.py -

# Stream voice data (what the server uses)
echo "Hello world" | uv run scripts/tts_mlx_streaming.py stdout
```

## System Requirements and Performance

### What It Uses
- **Memory**: About 2GB for the voice AI model
- **CPU**: Works hard when making voice, relaxes when quiet
- **Internet**: About 1KB/s for text, 96KB/s for voice per person using it
- **Hard drive**: About 1GB to store the downloaded voice model

### Making It Faster
- **Quality setting**: Use `--quantize 8` for good balance of speed and quality
- **Memory**: If you have a good graphics card, it will use that for speed
- **Multiple users**: Watch memory usage if many people use it at once
- **First time**: Downloads take 5-10 seconds, then much faster

### Using It for Real Projects
- **Docker**: Put it in a container for easy deployment
- **Multiple servers**: Use several servers behind a load balancer for many users
- **Keep models ready**: Load models at startup so first user isn't slow
- **Watch it**: Monitor memory use, queue sizes, and errors

## When Things Go Wrong

### Common Problems

**Voice model won't download**:
```bash
# Check your internet connection
# If using special models, you might need to login:
huggingface-cli login
```

**No sound coming out**:
- Check if your browser allows this website to play audio
- Make sure the connection shows "Connected" in the web page
- Try refreshing the page and trying again

**Using too much memory**:
- Change `--quantize 8` to `--quantize 4` (uses less memory but slower)
- Don't let too many people use it at the same time
- Watch the queue size in the server logs

**Python setup problems**:
```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Check Python version (needs 3.12 or newer)
python3 --version
```

### What the Logs Tell You

Server window shows:
- When people connect and disconnect
- What text is being turned into voice
- How much memory is being used
- When things break and get fixed automatically

Browser console shows:
- Audio format details
- Audio chunk processing
- Messages between browser and server

## Help Make It Better

1. Copy the project to your own GitHub
2. Make a new branch: `git checkout -b my-new-feature`
3. Make your changes and test them with multiple people
4. Send a pull request explaining what you changed

### Code Rules
- **TypeScript**: Strict type checking enabled
- **Server**: Modern JavaScript with Bun runtime
- **Web page**: React 19 with hooks
- **Python**: Type hints and good async code

## License

MIT License (you can use this for almost anything)

## Thank You

- **Kyutai Labs**: Made the amazing voice technology
- **OpenAI**: Provides the smart chat AI
- **MLX**: Makes it fast on Mac computers
- **Bun**: Super fast JavaScript runtime

---

**Built by [Kanishka Verma](mailto:kanisverma@gmail.com)** - Making AI voice conversations easy for everyone.