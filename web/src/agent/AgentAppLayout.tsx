import { MoonStar, Settings, SunMedium } from 'lucide-react';
import { useMemo, useState } from 'react';

import { SettingsDialog } from '../components/config/SettingsDialog';
import { Button } from '../components/ui/button';
import { useUIStore } from '../store/uiStore';
import { AgentChatPanel } from './AgentChatPanel';
import { AgentSessionList } from './components/AgentSessionList';
import { useAgentChat } from './useAgentChat';
import { WindowControls } from '../components/layout/WindowControls';
import { isDesktopRuntime } from '../lib/runtime';
import { resolveRuntimeRequestConfig, useConfigStore } from '../store/configStore';
import { HeaderModelPicker } from './components/HeaderModelPicker';

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

  const services = useConfigStore((state) => state.services);
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const selectedModelId = useMemo(
    () =>
      resolveRuntimeRequestConfig(services, runtimeModelConfig, serviceManagerSelectedId, 'main')
        .model,
    [services, runtimeModelConfig, serviceManagerSelectedId],
  );
  const displayModelId = selectedModelId || agentRuntimeStatus.model || '';

  const isDesktop = isDesktopRuntime();
  const headerIconButtonClass =
    'h-8 w-8 rounded-full border border-transparent text-foreground hover:bg-muted hover:text-foreground';

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        <AgentSessionList
          sessions={sessions}
          threadList={threadList}
          activeSessionId={activeSession?.sessionId || null}
          activeThreadId={activeSession?.threadId || null}
          onCreate={(workspaceRoot) => {
            void startNewSession(workspaceRoot);
          }}
          onResume={(threadId, cwd) => {
            void resumeThread(threadId, cwd);
          }}
          onDelete={(threadId) => {
            void archiveThread(threadId);
          }}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          <header
            className="grid grid-cols-[1fr_auto_1fr] items-center bg-background pr-2 pl-6 py-2 select-none"
            data-tauri-drag-region
          >
            <div data-tauri-drag-region />
            <div className="flex justify-center overflow-hidden" data-tauri-drag-region>
              <HeaderModelPicker currentModel={displayModelId} />
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
              activeSession={activeSession}
              approvalMode={approvalMode}
              agentRuntimeStatus={agentRuntimeStatus}
              agentConfigValidating={agentConfigValidating}
              onApprovalModeChange={setApprovalMode}
              onOpenSettings={() => setSettingsOpen(true)}
              onSendMessage={(payload) => {
                void sendMessage(payload);
              }}
              onStop={() => {
                void stop();
              }}
              onRespondApproval={(approvalId, decision) => {
                void respondApproval(approvalId, decision);
              }}
            />
          </div>
        </section>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
