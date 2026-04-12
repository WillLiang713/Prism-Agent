import { Minus, Square, X, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktopRuntime } from '../../lib/runtime';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktopRuntime()) return;

    const appWindow = getCurrentWindow();
    const updateMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };

    updateMaximized();
    const unlisten = appWindow.onResized(updateMaximized);

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (!isDesktopRuntime()) return null;

  const appWindow = getCurrentWindow();

  return (
    <div className="flex items-center h-full no-drag">
      <button
        onClick={() => appWindow.minimize()}
        className="inline-flex items-center justify-center h-10 w-10 hover:bg-muted text-mutedForeground hover:text-foreground transition-colors"
        title="最小化"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        className="inline-flex items-center justify-center h-10 w-10 hover:bg-muted text-mutedForeground hover:text-foreground transition-colors"
        title={isMaximized ? '还原' : '最大化'}
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={() => appWindow.close()}
        className="inline-flex items-center justify-center h-10 w-10 hover:bg-red-500/10 hover:text-red-500 text-mutedForeground transition-colors"
        title="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
