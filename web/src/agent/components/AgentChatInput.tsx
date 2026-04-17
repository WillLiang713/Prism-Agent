import { ArrowUp, Lightbulb, Paperclip, Play, Square, X } from 'lucide-react';
import {
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
import type { AgentApprovalMode, AgentReasoningEffort } from '../client';

export function AgentChatInput({
  inputDisabled,
  submitDisabled,
  submitHint,
  isStreaming,
  approvalMode,
  onApprovalModeChange,
  onSubmit,
  onStop,
}: {
  inputDisabled?: boolean;
  submitDisabled?: boolean;
  submitHint?: string;
  isStreaming: boolean;
  approvalMode: AgentApprovalMode;
  onApprovalModeChange: (mode: AgentApprovalMode) => void;
  onSubmit: (payload: {
    text: string;
    images: Array<{ name: string; mediaType: string; dataUrl: string }>;
    reasoningEffort: AgentReasoningEffort;
    approvalMode: AgentApprovalMode;
  }) => void;
  onStop: () => void;
}) {
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
        placeholder="输入你的需求…"
        className="min-h-[48px] resize-none border-0 bg-transparent px-3 py-1.5 text-sm leading-6 shadow-none focus-visible:ring-0"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <FileInput ref={fileInputRef} accept="image/*" multiple onChange={handleFileChange} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={inputDisabled || isStreaming}
            title="上传图片"
            className="h-10 w-10 shrink-0 bg-card p-0 shadow-sm"
            aria-label="上传图片"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as AgentReasoningEffort)}>
            <SelectTrigger className="h-10 w-[120px] px-4 text-xs">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                <span>{reasoningOptions.find((option) => option.value === reasoningEffort)?.label || '高'}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="min-w-0">
              {reasoningOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={approvalMode} onValueChange={(value) => onApprovalModeChange(value as AgentApprovalMode)}>
            <SelectTrigger className="h-10 w-[112px] px-4 text-xs" aria-label="执行模式">
              <div className="flex items-center gap-2">
                <Play aria-hidden="true" className="h-4 w-4 text-mutedForeground" />
                <span>{approvalMode === 'auto' ? '自动' : '手动'}</span>
              </div>
            </SelectTrigger>
            <SelectContent className="min-w-0">
              <SelectItem value="auto">自动</SelectItem>
              <SelectItem value="manual">手动</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isStreaming ? (
          <Button
            type="button"
            variant="danger"
            onClick={onStop}
            title="停止"
            aria-label="停止"
            className="h-7 w-7 p-0"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            disabled={submitDisabled}
            title={submitHint || '发送'}
            aria-label="发送"
            className="h-7 w-7 p-0"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </form>
  );
}
