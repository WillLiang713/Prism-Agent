import { ArrowUp, FolderOpen, Paperclip, Play, X } from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';

import { reasoningOptions } from '../../lib/configOptions';
import { Button } from '../../components/ui/button';
import { ContentImage } from '../../components/ui/content-image';
import { FileInput } from '../../components/ui/file-input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { resolveRuntimeRequestConfig, useConfigStore } from '../../store/configStore';
import type { AgentApprovalMode, AgentReasoningEffort } from '../client';
import { composerControlIcons } from './composerControlIcons';
import { HeaderModelPicker } from './HeaderModelPicker';

export function AgentChatInput({
  inputDisabled,
  submitDisabled,
  submitHint,
  isStreaming,
  approvalMode,
  fallbackModel,
  onApprovalModeChange,
  workspaceRoot,
  onPickWorkspace,
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
  onPickWorkspace: () => void;
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
  const [text, setText] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<AgentReasoningEffort>('high');
  const [images, setImages] = useState<Array<{ name: string; mediaType: string; dataUrl: string }>>(
    [],
  );
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
              <ContentImage src={image.dataUrl} alt={image.name} className="h-16 w-16 rounded-2xl object-cover" />
              <Button
                type="button"
                variant="inverse"
                size="iconSm"
                onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute -right-2 -top-2 h-8 w-8 rounded-full p-0"
                aria-label={`移除图片 ${image.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        onKeyDown={handleTextareaKeyDown}
        rows={1}
        disabled={inputDisabled || isStreaming}
        placeholder="把问题发给我，我来处理"
        className="min-h-[48px] resize-none border-0 bg-transparent px-3 py-1.5 text-sm leading-6 shadow-none focus-visible:ring-0"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileInput ref={fileInputRef} accept="image/*" multiple onChange={handleFileChange} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={inputDisabled || isStreaming}
            title="上传图片"
            className="h-8 w-8 shrink-0 bg-card p-0 shadow-none"
            aria-label="上传图片"
          >
            <Paperclip className="h-4 w-4 text-mutedForeground" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onPickWorkspace}
            disabled={inputDisabled}
            title={workspaceRoot || '选择工作区'}
            aria-label={workspaceRoot ? `当前工作区：${workspaceRoot}，点击选择其他工作区` : '选择工作区'}
            className="h-8 max-w-[180px] min-w-0 shrink-0 gap-2 rounded-full bg-card px-3 text-xs font-medium shadow-none"
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-mutedForeground" />
            <span className="min-w-0 truncate font-medium">
              {workspaceRoot?.split(/[\\/]/).filter(Boolean).pop() || '选择工作区'}
            </span>
          </Button>

          <Select value={approvalMode} onValueChange={(value) => onApprovalModeChange(value as AgentApprovalMode)}>
            <SelectTrigger className="h-8 w-[96px] cursor-pointer px-3 text-xs" aria-label="执行模式">
              <div className="flex items-center gap-2">
                <Play aria-hidden="true" className="h-4 w-4 text-mutedForeground" />
                <span className="font-medium">{approvalMode === 'auto' ? '自动' : '手动'}</span>
              </div>
            </SelectTrigger>
            <SelectContent side="top" className="min-w-0">
              <SelectItem value="auto" className="cursor-pointer">自动</SelectItem>
              <SelectItem value="manual" className="cursor-pointer">手动</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2.5">
          <HeaderModelPicker currentModel={displayModelId} />

          <Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as AgentReasoningEffort)}>
            <SelectTrigger className="h-8 w-[100px] cursor-pointer px-3 text-xs">
              <div className="flex items-center gap-2">
                <ReasoningIcon aria-hidden="true" className="h-4 w-4 text-mutedForeground" />
                <span className="font-medium">{reasoningOptions.find((option) => option.value === reasoningEffort)?.label || '高'}</span>
              </div>
            </SelectTrigger>
            <SelectContent side="top" className="min-w-0">
              {reasoningOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isStreaming ? (
            <Button
              type="button"
              variant="primary"
              onClick={onStop}
              title="停止"
              aria-label="停止"
              className="ml-0.5 h-7 w-7 p-0"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-[3px] bg-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              disabled={submitDisabled}
              title={submitHint || '发送'}
              aria-label="发送"
              className="ml-0.5 h-7 w-7 p-0"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
