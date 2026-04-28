import { ArrowUp, Check, ChevronDown, FolderOpen, Paperclip, Play, X } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { ListBox } from '@heroui/react/list-box';
import { Popover } from '@heroui/react/popover';
import { Select } from '@heroui/react/select';
import { TextArea } from '@heroui/react/textarea';
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { useAgentSessionStore } from '../sessionStore';

import { reasoningOptions } from '../../lib/configOptions';
import { cn } from '../../lib/utils';
import { resolveRuntimeRequestConfig, useConfigStore } from '../../store/configStore';
import type { AgentApprovalMode, AgentReasoningEffort } from '../client';
import { composerControlIcons } from './composerControlIcons';
import { HeaderModelPicker } from './HeaderModelPicker';

const composerControlBaseClassName =
  '!h-8 !min-h-8 !max-h-8 shrink-0 rounded-full border border-border bg-card !py-0 !text-[12px] font-medium leading-none text-foreground shadow-none transition-[background-color,border-color,color,box-shadow] hover:bg-muted focus-visible:ring-1 focus-visible:ring-foreground/20';

const composerIconButtonClassName = cn(
  composerControlBaseClassName,
  'w-8 p-0',
);

const composerTextControlClassName = cn(
  composerControlBaseClassName,
  'grid grid-cols-[1rem_minmax(2rem,1fr)_1rem] items-center gap-1.5 px-3',
);

const composerControlIconClassName =
  'h-4 w-4 shrink-0 justify-self-center text-mutedForeground';

const composerMenuItemStateClassName =
  'transition-colors hover:!bg-foreground/[0.06] focus-visible:!bg-foreground/[0.06] data-[hovered=true]:!bg-foreground/[0.06] data-[focused]:!bg-foreground/[0.06] data-[focus-visible=true]:!bg-foreground/[0.06] data-[selected=true]:!bg-foreground/[0.08] aria-[selected=true]:!bg-foreground/[0.08]';

const composerMenuItemClassName = cn(
  'flex w-full cursor-pointer select-none items-center justify-center rounded-lg px-3 py-2 text-center text-[13px] leading-5 text-foreground outline-none',
  composerMenuItemStateClassName,
);

const composerPopoverContentClassName =
  'z-50 overflow-hidden !rounded-xl border border-border !bg-muted !p-1 text-foreground !shadow-[0_18px_40px_rgba(0,0,0,0.22)]';

const composerPopoverDialogClassName = '!p-0 outline-none';

const composerSelectListBoxClassName = '!p-0';

const composerTextareaClassName =
  'min-h-[48px] w-full cursor-text resize-none border-0 bg-transparent px-3 py-1.5 !text-[13px] !leading-[18px] shadow-none placeholder:!text-[13px] placeholder:!leading-[18px] focus-visible:ring-0';

export function AgentChatInput({
  inputDisabled,
  submitDisabled,
  submitHint,
  isStreaming,
  approvalMode,
  fallbackModel,
  onApprovalModeChange,
  workspaceRoot,
  onSelectWorkspace,
  onSubmit,
  onStop,
}: {
  inputDisabled?: boolean;
  submitDisabled?: boolean;
  submitHint?: string;
  isStreaming: boolean;
  approvalMode: AgentApprovalMode;
  fallbackModel?: string;
  onApprovalModeChange: (mode: AgentApprovalMode) => void;
  workspaceRoot?: string;
  onSelectWorkspace: (cwd: string) => void;
  onSubmit: (payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: AgentReasoningEffort;
    approvalMode: AgentApprovalMode;
  }) => void;
  onStop: () => void;
}) {
  const ReasoningIcon = composerControlIcons.reasoning;
  const services = useConfigStore((state) => state.services);
  const runtimeModelConfig = useConfigStore((state) => state.runtimeModelConfig);
  const serviceManagerSelectedId = useConfigStore((state) => state.serviceManagerSelectedId);
  const selectedModelId = useMemo(
    () =>
      resolveRuntimeRequestConfig(services, runtimeModelConfig, serviceManagerSelectedId, 'main')
        .model,
    [services, runtimeModelConfig, serviceManagerSelectedId],
  );
  const displayModelId = selectedModelId || fallbackModel || '';
  const workspaceName = workspaceRoot?.split(/[\\/]/).filter(Boolean).pop() || '选择工作区';
  const pinnedDirectories = useAgentSessionStore((state) => state.pinnedDirectories);
  const [text, setText] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<AgentReasoningEffort>('high');
  const [images, setImages] = useState<Array<{ name: string; mediaType: string; dataUrl: string }>>(
    [],
  );
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function submitCurrentMessage() {
    if (submitDisabled) {
      return false;
    }

    if (!text.trim() && images.length === 0) {
      return false;
    }

    onSubmit({
      text,
      images,
      reasoningEffort,
      approvalMode,
    });
    setText('');
    setImages([]);
    return true;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    void Promise.all(
      files.map(
        (file) =>
          new Promise<{ name: string; mediaType: string; dataUrl: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                mediaType: file.type || 'image/png',
                dataUrl: String(reader.result || ''),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    ).then((nextImages) => {
      setImages((current) => [...current, ...nextImages.filter((image) => image.dataUrl)]);
    });
    event.currentTarget.value = '';
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitCurrentMessage();
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }
    if (event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    submitCurrentMessage();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[20px] bg-card p-3 shadow-none dark:shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
    >
      {images.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-3">
          {images.map((image, index) => (
            <div key={`${image.name}-${index}`} className="relative">
              <img
                src={image.dataUrl}
                alt={image.name}
                width={64}
                height={64}
                className="block h-16 w-16 max-w-full rounded-2xl object-cover"
              />
              <Button
                aria-label={`移除图片 ${image.name}`}
                type="button"
                variant="primary"
                size="sm"
                isIconOnly
                onPress={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute -right-2 -top-2 h-8 w-8 rounded-full p-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <TextArea
        aria-label="消息内容"
        name="agent-message"
        autoComplete="off"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={handleTextareaKeyDown}
        rows={1}
        fullWidth
        disabled={inputDisabled || isStreaming}
        placeholder="把问题发给我，我来处理…"
        className={composerTextareaClassName}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            name="message-images"
            aria-label="上传图片"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            aria-label="上传图片"
            type="button"
            variant="secondary"
            size="sm"
            isIconOnly
            onPress={() => fileInputRef.current?.click()}
            isDisabled={inputDisabled || isStreaming}
            className={composerIconButtonClassName}
          >
            <Paperclip className={composerControlIconClassName} aria-hidden="true" />
          </Button>

          <Popover isOpen={workspaceOpen} onOpenChange={setWorkspaceOpen}>
            <Button
              type="button"
              variant="secondary"
              isDisabled={inputDisabled}
              aria-label={workspaceRoot ? `当前工作区：${workspaceRoot}，点击切换` : '切换工作区'}
              className={cn(composerTextControlClassName, 'min-w-[112px] max-w-[180px]')}
            >
              <FolderOpen className={composerControlIconClassName} aria-hidden="true" />
              <span className="min-w-0 truncate text-center !text-[12px] font-medium leading-none">{workspaceName}</span>
              <ChevronDown className={composerControlIconClassName} aria-hidden="true" />
            </Button>
            <Popover.Content
              placement="top start"
              offset={6}
              className={cn(composerPopoverContentClassName, '!min-w-[220px] max-w-[320px]')}
            >
              <Popover.Dialog className={composerPopoverDialogClassName}>
                {pinnedDirectories.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-mutedForeground">
                    暂无可切换目录
                  </div>
                ) : (
                  <ListBox
                    aria-label="工作区"
                    className="!p-0"
                    selectedKeys={workspaceRoot ? [workspaceRoot] : []}
                    selectionMode="single"
                    onAction={(key) => {
                      const nextPath = String(key);
                      if (nextPath !== workspaceRoot) {
                        onSelectWorkspace(nextPath);
                      }
                      setWorkspaceOpen(false);
                    }}
                  >
                    {pinnedDirectories.map((path) => {
                      const name = path.split(/[\\/]/).filter(Boolean).pop() || path;
                      const isCurrentWorkspace = path === workspaceRoot;
                      return (
                        <ListBox.Item
                          key={path}
                          id={path}
                          textValue={name}
                          aria-current={isCurrentWorkspace ? 'true' : undefined}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-5 text-foreground outline-none',
                            composerMenuItemStateClassName,
                            isCurrentWorkspace && 'bg-foreground/[0.08]',
                          )}
                        >
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-mutedForeground" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-left" title={path}>{name}</span>
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-foreground transition-opacity',
                              isCurrentWorkspace ? 'opacity-100' : 'opacity-0',
                            )}
                            aria-hidden="true"
                          />
                        </ListBox.Item>
                      );
                    })}
                  </ListBox>
                )}
              </Popover.Dialog>
            </Popover.Content>
          </Popover>

          <Select
            aria-label="执行模式"
            selectedKey={approvalMode}
            onSelectionChange={(key) => {
              if (key) {
                onApprovalModeChange(String(key) as AgentApprovalMode);
              }
            }}
            className="w-auto"
          >
            <Select.Trigger
              className={cn(composerTextControlClassName, 'w-[108px] cursor-pointer')}
            >
              <Play aria-hidden="true" className={composerControlIconClassName} />
              <Select.Value className="min-w-0 truncate whitespace-nowrap text-center !text-[12px] font-medium leading-none" />
              <Select.Indicator className="justify-self-center text-mutedForeground">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover
              placement="top"
              className={cn(composerPopoverContentClassName, '!min-w-[5.5rem]')}
            >
              <ListBox aria-label="执行模式" className={composerSelectListBoxClassName}>
                <ListBox.Item
                  id="auto"
                  textValue="自动"
                  className={composerMenuItemClassName}
                >
                  自动
                </ListBox.Item>
                <ListBox.Item
                  id="manual"
                  textValue="手动"
                  className={composerMenuItemClassName}
                >
                  手动
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="flex items-center gap-2.5">
          <HeaderModelPicker currentModel={displayModelId} />

          <Select
            aria-label="思考模式"
            selectedKey={reasoningEffort}
            onSelectionChange={(key) => {
              if (key) {
                setReasoningEffort(String(key) as AgentReasoningEffort);
              }
            }}
            className="w-auto"
          >
            <Select.Trigger
              className={cn(composerTextControlClassName, 'w-[108px] cursor-pointer')}
            >
              <ReasoningIcon aria-hidden="true" className={composerControlIconClassName} />
              <Select.Value className="min-w-0 truncate whitespace-nowrap text-center !text-[12px] font-medium leading-none" />
              <Select.Indicator className="justify-self-center text-mutedForeground">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover
              placement="top"
              className={cn(composerPopoverContentClassName, '!min-w-[5.5rem]')}
            >
              <ListBox aria-label="思考模式" className={composerSelectListBoxClassName}>
                {reasoningOptions.map((option) => (
                  <ListBox.Item
                    key={option.value}
                    id={option.value}
                    textValue={option.label}
                    className={composerMenuItemClassName}
                  >
                    {option.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          {isStreaming ? (
            <Button
              aria-label="停止"
              type="button"
              variant="primary"
              size="sm"
              isIconOnly
              onPress={onStop}
              className={cn(composerIconButtonClassName, 'ml-0.5')}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-[3px] bg-current" />
            </Button>
          ) : (
            <Button
              aria-label={submitHint ? `发送，${submitHint}` : '发送'}
              type="submit"
              variant="primary"
              size="sm"
              isIconOnly
              isDisabled={submitDisabled}
              className={cn(composerIconButtonClassName, 'ml-0.5')}
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
