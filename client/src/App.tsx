import ChatInterface from './components/ChatInterface';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Real-time Voice Chat
            </h1>
            <p className="text-lg text-muted-foreground">
              Text streams instantly, audio plays as it generates
            </p>
          </div>
        </div>
      </header>
      <main className="pb-8">
        <ChatInterface />
      </main>
    </div>
  );
}

export default App;
