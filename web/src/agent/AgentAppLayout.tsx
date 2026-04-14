import { MoonStar, Settings, SunMedium } from 'lucide-react';
import { useState } from 'react';

import { SettingsDialog } from '../components/config/SettingsDialog';
import { Button } from '../components/ui/button';
import { useUIStore } from '../store/uiStore';
import { AgentChatPanel } from './AgentChatPanel';
import { useAgentChat } from './useAgentChat';
import { WindowControls } from '../components/layout/WindowControls';
import { isDesktopRuntime } from '../lib/runtime';

export function AgentAppLayout() {
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
    approvalMode,
    agentRuntimeStatus,
    agentConfigValidating,
    setApprovalMode,
    startNewSession,
    resumeThread,
    sendMessage,
    stop,
    respondApproval,
    archiveThread,
  } = useAgentChat();

  const isDesktop = isDesktopRuntime();
  const headerIconButtonClass =
    'h-8 w-8 rounded-full border border-transparent text-foreground hover:bg-muted hover:text-foreground';

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
                    className="flex max-w-[420px] items-center gap-1.5 truncate text-xs font-medium tracking-tight text-mutedForeground/80 transition-colors hover:text-foreground"
                    title={activeSession.workspaceRoot}
                  >
                    <span className="truncate font-mono">{activeSession.workspaceRoot}</span>
                  </div>
                ) : null}
            </div>
            <div className="flex justify-center overflow-hidden" data-tauri-drag-region>
              {agentRuntimeStatus.model && (
                <div
                  className="flex items-center text-xs font-mono lowercase text-mutedForeground/80"
                  data-tauri-drag-region
                >
                  {agentRuntimeStatus.model}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-1" data-tauri-drag-region>
              <div className="flex items-center gap-1 no-drag mr-2">
                <Button size="icon" variant="ghost" onClick={toggleTheme} className={headerIconButtonClass}>
                  {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setSettingsOpen(true)} className={headerIconButtonClass}>
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              {isDesktop && <WindowControls />}
            </div>
          </header>
          <div className="flex-1 overflow-hidden select-text">
            <AgentChatPanel
              initialized={initialized}
              backendReady={backendReady}
              backendError={backendError}
              threadList={threadList}
              sessions={sessions}
              activeSession={activeSession}
              approvalMode={approvalMode}
              agentRuntimeStatus={agentRuntimeStatus}
              agentConfigValidating={agentConfigValidating}
              onApprovalModeChange={setApprovalMode}
              onOpenSettings={() => setSettingsOpen(true)}
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
