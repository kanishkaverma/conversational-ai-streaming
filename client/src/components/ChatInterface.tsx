import React, { useState, useEffect, useCallback, useRef } from 'react';
import useWebSocketChat from '../hooks/useWebSocketChat';
import { useParakeetTranscription } from '../hooks/useParakeetTranscription';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ChatInterface: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const { isConnected, messages, currentResponse, currentUserMessage, isStreaming, error, sendMessage } = useWebSocketChat();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, currentResponse]);
  
  // Transcription hooks
  const { state: transcriptionState, initializeModel, transcribe, isReady } = useParakeetTranscription();
  const { state: recordingState, startRecording, stopRecording, isRecording } = useAudioRecording();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isStreaming) {
      await sendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Initialize Parakeet model on component mount
  useEffect(() => {
    initializeModel();
  }, [initializeModel]);

  // Handle microphone recording
  const handleMicrophonePress = useCallback(async () => {
    if (isRecording) return;
    
    console.log('Starting microphone recording...');
    await startRecording();
  }, [isRecording, startRecording]);

  const handleMicrophoneRelease = useCallback(async () => {
    if (!isRecording) return;
    
    console.log('Stopping microphone recording...');
    const pcmData = await stopRecording();
    
    if (pcmData && isReady) {
      console.log('Transcribing recorded audio...');
      const result = await transcribe(pcmData);
      
      if (result && result.text.trim()) {
        setInputValue(result.text.trim());
        console.log(`Transcription complete: "${result.text}"`);
      }
    }
  }, [isRecording, stopRecording, isReady, transcribe]);

  // Keyboard shortcuts for microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger microphone on space if not typing in an input field
      const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (e.code === 'Space' && !e.repeat && !isStreaming && !isTyping) {
        e.preventDefault();
        handleMicrophonePress();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Only handle space release for microphone if not typing in an input field
      const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (e.code === 'Space' && isRecording && !isTyping) {
        e.preventDefault();
        handleMicrophoneRelease();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isStreaming, handleMicrophonePress, handleMicrophoneRelease]);

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Status Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Connection & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <Badge 
                variant={isConnected ? "success" : "error"}
                className={cn(
                  "transition-all duration-200",
                  isConnected && "animate-pulse"
                )}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {isStreaming && (
                <Badge variant="default" className="animate-pulse">
                  Streaming
                </Badge>
              )}
            </div>
            
            <Separator />
            
            {/* Transcription Status */}
            <div className="flex flex-wrap gap-2">
              {transcriptionState.status === 'loading' && (
                <Badge variant="default" className="animate-pulse">
                  Loading Model ({transcriptionState.progress}%)
                </Badge>
              )}
              {transcriptionState.status === 'warming-up' && (
                <Badge variant="warning" className="animate-pulse">
                  Warming up model...
                </Badge>
              )}
              {transcriptionState.status === 'ready' && (
                <Badge variant="success">
                  Transcription Ready
                </Badge>
              )}
              {transcriptionState.status === 'transcribing' && (
                <Badge variant="default" className="animate-pulse">
                  Transcribing...
                </Badge>
              )}
              {transcriptionState.status === 'error' && (
                <Badge variant="error">
                  {transcriptionState.errorMessage}
                </Badge>
              )}
            </div>

            {/* Recording Status */}
            {recordingState.status !== 'idle' && (
              <div className="flex flex-wrap gap-2">
                {isRecording && (
                  <Badge variant="error" className="animate-pulse">
                    Recording ({Math.floor(recordingState.duration / 1000)}s)
                  </Badge>
                )}
                {recordingState.status === 'processing' && (
                  <Badge variant="secondary" className="animate-pulse">
                    Processing audio...
                  </Badge>
                )}
                {recordingState.status === 'error' && (
                  <Badge variant="error">
                    {recordingState.errorMessage}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat History */}
        <Card className="min-h-[400px]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Chat History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[340px] w-full" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 && !isStreaming ? (
                  <div className="text-muted-foreground text-center py-8">
                    Send a message to start the conversation
                  </div>
                ) : (
                  <>
                    {/* Previous messages */}
                    {messages.map((message) => (
                      <div key={message.id} className={cn(
                        "p-3 rounded-lg max-w-[80%]",
                        message.type === 'user' 
                          ? "bg-primary text-primary-foreground ml-auto" 
                          : "bg-muted mr-auto"
                      )}>
                        <div className="text-sm font-medium mb-1">
                          {message.type === 'user' ? 'You' : 'AI'}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                        <div className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                    
                    {/* Current streaming conversation */}
                    {isStreaming && currentUserMessage && (
                      <div className="p-3 rounded-lg max-w-[80%] bg-primary text-primary-foreground ml-auto">
                        <div className="text-sm font-medium mb-1">You</div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {currentUserMessage}
                        </div>
                      </div>
                    )}
                    
                    {/* Current AI response */}
                    {(currentResponse || isStreaming) && (
                      <div className="p-3 rounded-lg max-w-[80%] bg-muted mr-auto">
                        <div className="text-sm font-medium mb-1 flex items-center gap-2">
                          AI
                          {isStreaming && (
                            <Badge variant="default" className="animate-pulse text-xs">
                              Streaming
                            </Badge>
                          )}
                        </div>
                        {currentResponse ? (
                          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {currentResponse}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        )}
                        {isStreaming && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            Audio playing in real-time
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Input Form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder={isReady ? "Type your message or hold space to record..." : "Type your message..."}
                  disabled={!isConnected || isStreaming}
                  className="w-full"
                />
              </div>
              
              {/* Microphone Button */}
              {isReady && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={isRecording ? "destructive" : "secondary"}
                        size="icon"
                        onMouseDown={handleMicrophonePress}
                        onMouseUp={handleMicrophoneRelease}
                        onTouchStart={handleMicrophonePress}
                        onTouchEnd={handleMicrophoneRelease}
                        disabled={!isConnected || isStreaming || transcriptionState.status === 'transcribing'}
                        className={cn(
                          "transition-all duration-200",
                          isRecording && "animate-pulse scale-110"
                        )}
                      >
                        <span className="text-lg">
                          {isRecording ? '●' : recordingState.status === 'processing' ? '⚙' : '🎙'}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Hold to record (or hold space)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <Button 
                type="submit" 
                disabled={!isConnected || isStreaming || !inputValue.trim()}
                className="px-6"
              >
                {isStreaming ? 'Sending...' : 'Send'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default ChatInterface;