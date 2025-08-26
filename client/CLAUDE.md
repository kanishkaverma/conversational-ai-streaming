# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Development server with hot reload
npm run dev          # Runs on http://localhost:5173

# Production build  
npm run build        # TypeScript compilation + Vite build to dist/

# Code quality checks
npm run lint         # ESLint validation

# Preview production build
npm run preview      # Preview dist/ build locally
```

### Package Management
- Uses `npm` with `package-lock.json`
- Node.js with ES modules (`"type": "module"`)
- Dependencies include React 19, TypeScript, Vite, and AI SDK

## Architecture Overview

This is a **real-time voice chat client** that provides simultaneous text and audio streaming through WebSocket connections.

### Core Architecture Pattern
- **React 19 + TypeScript + Vite** frontend
- **WebSocket-based real-time communication** (`ws://localhost:3000`)
- **Web Audio API** for PCM audio streaming (24kHz, 32-bit float)
- **Custom hook pattern** for WebSocket + audio state management

### Key Components Structure

```
src/
├── App.tsx                    # Main app wrapper
├── components/
│   └── ChatInterface.tsx      # Primary UI component
└── hooks/
    └── useWebSocketChat.ts    # WebSocket + audio logic
```

### Critical Technical Details

#### WebSocket Protocol (src/hooks/useWebSocketChat.ts:120)
- **Server**: `ws://localhost:3000`
- **Client→Server**: `{type: 'chat', prompt: 'message'}`
- **Server→Client**: JSON messages + binary PCM audio chunks
- **Auto-reconnect**: 3-second delay on disconnect

#### Audio System (src/hooks/useWebSocketChat.ts:27)
- **Format**: Raw PCM, 32-bit float, 24kHz mono, little-endian
- **Real-time streaming**: Seamless audio chunk scheduling
- **Web Audio API**: Direct ArrayBuffer to AudioBuffer conversion
- **Cleanup**: Automatic audio source management

#### State Management Pattern
- Single custom hook (`useWebSocketChat`) manages:
  - WebSocket connection state
  - Audio context and playback queue
  - Real-time text streaming state
  - Error handling and recovery

### Message Flow Architecture
1. User types message → `sendMessage()` called
2. JSON sent to WebSocket server  
3. Server responds with:
   - `text_chunk` messages (immediate)
   - Binary PCM audio data (1-3s delay)
4. Text streams to UI, audio plays seamlessly
5. `text_complete` signals end of response

## Development Guidelines

### Code Conventions
- **TypeScript strict mode** with modern React patterns
- **Functional components** with hooks
- **Custom hooks** for complex state logic
- **CSS modules** not used - direct CSS classes
- **ES modules** throughout

### Audio Development Notes
- Audio context must be user-activated (browser policy)
- PCM chunks arrive as `ArrayBuffer` or `Blob`
- `nextPlayTimeRef` ensures gapless audio streaming
- Audio sources auto-cleanup via `onended` handlers

### WebSocket Development Notes  
- Connection state managed via `useRef` for persistence
- Message parsing handles both JSON and binary data
- Auto-reconnection prevents permanent disconnection
- Error states displayed to user with visual feedback

### Build Configuration
- **Vite** with SWC React plugin for fast builds
- **ESLint** with TypeScript + React hooks rules
- **TypeScript**: separate configs for app (`tsconfig.app.json`) and build tools (`tsconfig.node.json`)

## Testing & Quality
- **No test framework configured** - add tests by examining existing patterns first
- **ESLint** configured with recommended TypeScript + React rules
- **No CI/CD** configured in this client

## Common Development Tasks

### Adding New WebSocket Message Types
1. Update message handling in `useWebSocketChat.ts:84` switch statement
2. Add corresponding state if needed
3. Update UI in `ChatInterface.tsx` to display new state

### Modifying Audio Format
1. Update audio context sample rate in `useWebSocketChat.ts:19`
2. Modify PCM conversion logic in `playAudioChunk` method
3. Ensure server sends matching format

### Styling Changes
1. CSS classes defined in `src/App.css`
2. Status indicators use conditional CSS classes
3. Responsive design with mobile considerations