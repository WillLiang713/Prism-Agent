import { Minus, Square, X, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react/button';
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={() => void appWindow.minimize()}
        aria-label="最小化"
        className="h-10 min-h-10 w-10 min-w-10 rounded-none bg-transparent p-0 text-mutedForeground shadow-none transition-colors hover:bg-muted hover:text-foreground"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={() => void appWindow.toggleMaximize()}
        aria-label={isMaximized ? '还原' : '最大化'}
        className="h-10 min-h-10 w-10 min-w-10 rounded-none bg-transparent p-0 text-mutedForeground shadow-none transition-colors hover:bg-muted hover:text-foreground"
      >
        {isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        isIconOnly
        onPress={() => void appWindow.close()}
        aria-label="关闭"
        className="h-10 min-h-10 w-10 min-w-10 rounded-none bg-transparent p-0 text-mutedForeground shadow-none transition-colors hover:bg-red-500/10 hover:text-red-500"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
