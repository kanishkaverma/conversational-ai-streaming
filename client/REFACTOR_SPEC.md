# Client Application Refactoring Specification

## Current State Analysis

### Identified Issues
1. **Two parallel chat interfaces** (ChatInterface.tsx and ChatConversation.tsx) with overlapping functionality
2. **Overly complex AI elements** library (16+ components) mostly unused
3. **Heavy dependencies** - Parakeet transcription adds significant bundle size
4. **Redundant state management** - Multiple hooks managing similar states
5. **Performance bottlenecks** - Unnecessary re-renders, large component trees
6. **Complex audio processing** - Multiple conversion steps for transcription

## Refactoring Goals
- **Simplify**: Single, focused chat interface
- **Performance**: Reduce bundle size by 50%+
- **Maintainability**: Clear separation of concerns
- **User Experience**: Faster load times, smoother interactions

## Implementation Plan

### Phase 1: Component Simplification
1. **Merge chat components** into single streamlined ChatInterface
2. **Remove unused AI elements** (keep only essential: message, loader, response)
3. **Simplify UI components** - inline simple ones, remove unused shadcn components

### Phase 2: State & Hook Optimization
1. **Consolidate hooks** into single `useChatSession` hook
2. **Simplify audio handling** - direct PCM processing without multiple conversions
3. **Optional transcription** - lazy load Parakeet only when needed

### Phase 3: WebSocket & Audio Improvements
1. **Optimize WebSocket reconnection** logic
2. **Simplify audio playback** - remove unnecessary processing
3. **Add audio queue management** for smoother playback

### Phase 4: Bundle Optimization
1. **Remove unused dependencies**:
   - Most @radix-ui components
   - Unused AI SDK features
   - Heavy components (carousel, collapsible, etc.)
2. **Code splitting** for transcription feature
3. **Tree-shake** shadcn components

## New Architecture

```
src/
├── components/
│   ├── ChatInterface.tsx     # Single unified chat component
│   └── ui/                    # Minimal UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── badge.tsx
├── hooks/
│   └── useChatSession.ts     # Consolidated chat hook
├── lib/
│   ├── websocket.ts          # WebSocket client
│   ├── audio.ts              # Audio utilities
│   └── transcription.ts      # Optional transcription
└── App.tsx                    # Simplified app shell
```

## Key Improvements

### Performance
- **50% smaller bundle** through dependency removal
- **Faster initial load** with code splitting
- **Smoother audio** with optimized buffering
- **Fewer re-renders** with better state management

### Code Quality
- **Single source of truth** for chat state
- **Clear separation** between core and optional features
- **Type-safe** WebSocket messages
- **Better error boundaries**

### User Experience
- **Instant connection** feedback
- **Smooth audio streaming** without glitches
- **Optional features** load on-demand
- **Responsive design** with minimal CSS

## Migration Strategy
1. Create new simplified components alongside existing
2. Gradually move functionality
3. Test thoroughly at each step
4. Remove old components once stable

## Success Metrics
- Bundle size < 200KB (currently ~500KB)
- First paint < 1s
- WebSocket reconnect < 500ms
- Zero audio glitches
- 90%+ code coverage