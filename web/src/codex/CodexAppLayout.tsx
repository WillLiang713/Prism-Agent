import { MoonStar, Settings, SunMedium, FolderOpen } from 'lucide-react';
import { useState } from 'react';

import { SettingsDialog } from '../components/config/SettingsDialog';
import { Button } from '../components/ui/button';
import { useUIStore } from '../store/uiStore';
import { CodexChatPanel } from './CodexChatPanel';
import { useCodexChat } from './useCodexChat';
import { WindowControls } from '../components/layout/WindowControls';
import { isDesktopRuntime } from '../lib/runtime';

export function CodexAppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const {
    initialized,
    backendReady,
    backendError,
    threadList,
    sessions,
    activeSession,
    startNewSession,
    resumeThread,
    sendMessage,
    stop,
    respondApproval,
    archiveThread,
  } = useCodexChat();

  const isDesktop = isDesktopRuntime();
  const headerIconButtonClass =
    'h-10 w-10 rounded-full border border-transparent text-foreground hover:bg-muted hover:text-foreground';

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col">
          <header 
            className="grid grid-cols-[1fr_auto_1fr] items-center pr-2 pl-6 py-2 select-none"
            data-tauri-drag-region
          >
            <div className="flex items-center gap-2 overflow-hidden" data-tauri-drag-region>
               {activeSession?.workspaceRoot ? (
                 <div 
                   className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 text-[11px] text-mutedForeground truncate max-w-[280px]"
                   title={activeSession.workspaceRoot}
                 >
                   <FolderOpen className="h-3 w-3 shrink-0 opacity-60" />
                   <span className="truncate font-mono">{activeSession.workspaceRoot}</span>
                 </div>
               ) : null}
            </div>
            <div />
            <div className="flex items-center justify-end gap-1" data-tauri-drag-region>
              <div className="flex items-center gap-1 no-drag mr-2">
                <Button size="icon" variant="ghost" onClick={toggleTheme} className={headerIconButtonClass}>
                  {theme === 'dark' ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} className={headerIconButtonClass}>
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
              {isDesktop && <WindowControls />}
            </div>
          </header>
          <div className="flex-1 overflow-hidden select-text">
            <CodexChatPanel
              initialized={initialized}
              backendReady={backendReady}
              backendError={backendError}
              threadList={threadList}
              sessions={sessions}
              activeSession={activeSession}
              onCreateSession={(workspaceRoot) => {
                void startNewSession(workspaceRoot);
              }}
              onResumeThread={(threadId, cwd) => {
                void resumeThread(threadId, cwd);
              }}
              onSendMessage={(payload) => {
                void sendMessage(payload);
              }}
              onStop={() => {
                void stop();
              }}
              onRespondApproval={(approvalId, decision) => {
                void respondApproval(approvalId, decision);
              }}
              onDeleteThread={(threadId) => {
                void archiveThread(threadId);
              }}
            />
          </div>
        </section>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
