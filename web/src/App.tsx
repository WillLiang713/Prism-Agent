import { useEffect } from 'react';

import { AgentAppLayout } from './agent/AgentAppLayout';
import { TooltipProvider } from './components/ui/tooltip';
import { useUIStore } from './store/uiStore';

export default function App() {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <TooltipProvider delayDuration={300}>
      <AgentAppLayout />
    </TooltipProvider>
  );
}
