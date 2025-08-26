import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Real-time Voice Chat
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
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
