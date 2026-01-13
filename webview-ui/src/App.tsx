import { useVSCodeBridge } from './hooks/useVSCodeBridge';
import { Canvas } from './components/Canvas';
import { SessionBrowser } from './components/SessionBrowser';

function App() {
  useVSCodeBridge();

  return (
    <div className="min-h-screen bg-[var(--vscode-editor-background)]">
      <Canvas />
      <SessionBrowser />
    </div>
  );
}

export default App;
