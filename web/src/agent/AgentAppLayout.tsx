import { MoonStar, Settings, SunMedium } from 'lucide-react';
import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

import { SettingsDialog } from '../components/config/SettingsDialog';
import { Button } from '../components/ui/button';
import { useUIStore } from '../store/uiStore';
import { AgentChatPanel } from './AgentChatPanel';
import { AgentSessionList } from './components/AgentSessionList';
import { useAgentChat } from './useAgentChat';
import { useAgentSessionStore } from './sessionStore';
import { WindowControls } from '../components/layout/WindowControls';
import { isDesktopRuntime } from '../lib/runtime';
import { resolveWorkspaceSelection } from './workspaceSelection';

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
    regenerateThreadTitle,
  } = useAgentChat();

  const isDesktop = isDesktopRuntime();
  const pinDirectory = useAgentSessionStore((state) => state.pinDirectory);
  const headerIconButtonClass =
    'h-8 w-8 rounded-full border border-transparent text-foreground hover:bg-muted hover:text-foreground';

  const handleWorkspaceSelection = async (selectedWorkspace: string) => {
    const selection = resolveWorkspaceSelection(selectedWorkspace, threadList);

    if (selection.mode === 'resume') {
      await resumeThread(selection.threadId, selection.cwd);
      return;
    }

    await startNewSession(selection.cwd);
  };

  const handlePinWorkspace = async () => {
    if (!isDesktop) {
      const selected = window.prompt('输入要载入到列表的目录路径');
      if (selected?.trim()) {
        pinDirectory(selected.trim());
      }
      return;
    }

    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择要载入的目录',
    });
    if (typeof selected === 'string') {
      pinDirectory(selected);
    }
  };

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
          onRegenerateTitle={(threadId) => regenerateThreadTitle(threadId)}
          onPickWorkspace={() => {
            void handlePinWorkspace();
          }}
        />
        <section className="flex min-w-0 flex-1 flex-col">
          <header
            className="grid grid-cols-[1fr_auto_1fr] items-center bg-background pr-2 pl-6 py-2 select-none"
            data-tauri-drag-region
          >
            <div data-tauri-drag-region />
            <div data-tauri-drag-region />
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
              onSelectWorkspace={(cwd) => {
                void handleWorkspaceSelection(cwd);
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
            />
          </div>
        </section>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
