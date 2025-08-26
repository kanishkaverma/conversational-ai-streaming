import { useState, type FormEvent } from 'react';
import { useChatSession } from '../hooks/useChatSession';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

export function SimpleChatInterface() {
  const [input, setInput] = useState('');
  const { isConnected, isStreaming, currentResponse, error, sendMessage } = useChatSession();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (message && !isStreaming) {
      await sendMessage(message);
      setInput('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center justify-between">
            <span>Real-time Voice Chat</span>
            <div className="flex gap-2">
              <Badge 
                variant={isConnected ? 'default' : 'destructive'}
                className={cn(isConnected && 'bg-green-600')}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {isStreaming && (
                <Badge className="animate-pulse">
                  Streaming
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Response Area */}
      <Card className="min-h-[300px]">
        <CardHeader>
          <CardTitle className="text-lg font-medium">AI Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] overflow-y-auto">
            {currentResponse ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {currentResponse}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {isStreaming ? (
                  <div className="space-y-2 text-center">
                    <div className="animate-pulse">Generating response...</div>
                    <div className="text-xs">Audio playing in real-time</div>
                  </div>
                ) : (
                  'Send a message to start the conversation'
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Input Form */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={!isConnected || isStreaming}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!isConnected || isStreaming || !input.trim()}
            >
              {isStreaming ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}