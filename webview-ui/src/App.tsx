import { useVSCodeBridge } from './hooks/useVSCodeBridge';
import { Canvas } from './components/Canvas';

function App() {
  useVSCodeBridge();

  return (
    <div className="min-h-screen bg-[var(--vscode-editor-background)]">
      <Canvas />
    </div>
  );
}

export default App;
