import { memo, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { MarkdownContent } from './MarkdownContent';
import { STREAMING_PLAIN_TEXT_CLASS } from './MarkdownContent.styles';
import { normalizeAssistantMarkdown } from './assistantMarkdown';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import { splitStreamingMarkdownForRender } from './streamingMarkdown';
import type { AgentMessage } from '../sessionStore';
import type { AgentTimelineItem } from '../client';

const STREAMING_FRAME_MAX_DELTA_MS = 34;
const STREAMING_MIN_CHARS_PER_SEC = 90;
const STREAMING_MAX_CHARS_PER_SEC = 360;
const STREAMING_TARGET_BACKLOG = 20;
const STREAMING_BACKLOG_GAIN = 4;
const STREAMING_SPEED_SMOOTHING = 0.22;
const STREAMING_MAX_CHARS_PER_FRAME = 6;
const STREAMING_SOURCE_SPEED_SMOOTHING = 0.35;
const STREAMING_BUFFER_WINDOW_MS = 240;
const STREAMING_BUFFER_HOLD_IDLE_MS = 340;
const STREAMING_BUFFER_DECAY_MS = 320;
const STREAMING_MIN_BUFFER_CHARS = 24;
const STREAMING_MAX_BUFFER_CHARS = 96;
const GENERATION_IDLE_INDICATOR_DELAY_MS = 1400;

export function AgentMessageList({
  messages,
  isStreaming,
}: {
  messages: AgentMessage[];
  isStreaming: boolean;
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-8 pb-10">
      {messages.map((message, index) => {
        const generating = isStreaming && index === messages.length - 1;
        return (
          <AgentMessageItem key={message.id} message={message} generating={generating} />
        );
      })}
    </div>
  );
}

const AgentMessageItem = memo(function AgentMessageItem({
  message,
  generating,
}: {
  message: AgentMessage;
  generating: boolean;
}) {
  if (message.role === 'user') {
    return <UserMessageItem text={message.text} />;
  }

  return <AssistantMessageItem message={message} generating={generating} />;
});

function UserMessageItem({ text }: { text: string }) {
  return (
    <article className="group/user flex flex-col items-end gap-1">
      <div className="w-fit max-w-[90%] rounded-[10px] border border-border bg-accent px-3 py-2 text-sm leading-6 text-accentForeground">
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
      <CopyMessageButton text={text} />
    </article>
  );
}

function AssistantMessageItem({
  message,
  generating,
}: {
  message: AgentMessage;
  generating: boolean;
}) {
  const isWaitingForFirstContent =
    generating &&
    !message.error &&
    !message.timeline.some(hasVisibleTimelineItem);
  const shouldTrackIdleStatus =
    generating &&
    !message.error &&
    !isWaitingForFirstContent &&
    !message.timeline.some(hasActiveThinkingItem) &&
    message.timeline.some(hasVisibleTimelineItem);
  const visibleActivitySignature = buildVisibleActivitySignature(message);
  const activeStreamingTextItemId = generating ? getActiveStreamingTextItemId(message.timeline) : null;
  const [showIdleStatus, setShowIdleStatus] = useState(false);

  useEffect(() => {
    if (!shouldTrackIdleStatus) {
      setShowIdleStatus(false);
      return;
    }

    setShowIdleStatus(false);
    const timer = window.setTimeout(() => {
      setShowIdleStatus(true);
    }, GENERATION_IDLE_INDICATOR_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [shouldTrackIdleStatus, visibleActivitySignature]);

  return (
    <article className="space-y-4 min-w-0 overflow-hidden">
      {isWaitingForFirstContent ? <PendingAssistantStatus /> : null}
      {message.timeline.length > 0 ? (
        <div className="space-y-2 min-w-0">
          {message.timeline.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              isStreamingText={item.type === 'text' && item.id === activeStreamingTextItemId}
            />
          ))}
        </div>
      ) : null}
      {showIdleStatus ? <GenerationIdleStatus /> : null}
      {message.error ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
          {message.error}
        </div>
      ) : null}
    </article>
  );
}

function buildVisibleActivitySignature(message: AgentMessage) {
  const timelineSignature = message.timeline
    .map((item) => {
      if (item.type === 'thinking') {
        return [
          item.type,
          item.status,
          item.text.length,
          item.durationSec ?? '',
        ].join(':');
      }

      if (item.type === 'text') {
        return [
          item.type,
          item.text.length,
        ].join(':');
      }

      return [
        item.type,
        item.toolCallId,
        item.status,
        item.output.length,
        item.diff?.length ?? 0,
        item.exitCode ?? '',
        item.summary?.length ?? 0,
      ].join(':');
    })
    .join('|');

  return `${message.text.length}:${timelineSignature}`;
}

function hasVisibleTimelineItem(item: AgentTimelineItem) {
  if (item.type === 'text') {
    return item.text.trim().length > 0;
  }
  if (item.type === 'tool') {
    return true;
  }

  return item.status === 'streaming' || item.text.trim().length > 0;
}

function hasActiveThinkingItem(item: AgentTimelineItem) {
  return item.type === 'thinking' && item.status === 'streaming';
}

function getActiveStreamingTextItemId(timeline: AgentTimelineItem[]) {
  const lastItem = timeline.at(-1);
  return lastItem?.type === 'text' ? lastItem.id : null;
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="h-1 w-1 rounded-full bg-current opacity-35" />
      <span className="h-1 w-1 rounded-full bg-current opacity-55" />
      <span className="h-1 w-1 rounded-full bg-current opacity-75" />
    </span>
  );
}

function PendingAssistantStatus() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-fit max-w-full items-center gap-2 text-xs leading-5 text-mutedForeground/80"
    >
      <span className="thinking-title-shimmer">正在准备回复</span>
      <LoadingDots />
    </div>
  );
}

function GenerationIdleStatus() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-fit max-w-full items-center gap-2 text-xs leading-5 text-mutedForeground/72"
    >
      <span className="thinking-title-shimmer">继续处理</span>
      <LoadingDots />
    </div>
  );
}

function TimelineItem({
  item,
  isStreamingText,
}: {
  item: AgentTimelineItem;
  isStreamingText: boolean;
}) {
  if (item.type === 'text') {
    if (!item.text.trim()) {
      return null;
    }
    return <MessageBody text={item.text} isStreaming={isStreamingText} />;
  }

  if (item.type === 'thinking') {
    if (item.status !== 'streaming' && !item.text.trim()) {
      return null;
    }

    return (
      <ThinkingBlock
        text={item.text}
        status={item.status}
        startedAt={item.startedAt}
        durationSec={item.durationSec}
      />
    );
  }

  return <ToolCallCard event={item} />;
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? '已复制' : '复制'}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-mutedForeground/70 opacity-0 transition hover:bg-accent hover:text-foreground focus:opacity-100 focus:outline-none group-hover/user:opacity-100"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function MessageBody({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  if (isStreaming) {
    return <StreamingMessageBody text={text} />;
  }

  return <CompletedMessageBody text={text} />;
}

function CompletedMessageBody({ text }: { text: string }) {
  const deferredText = useDeferredValue(text);
  const normalizedText = normalizeAssistantMarkdown(deferredText);

  return <MarkdownContent text={normalizedText} />;
}

function StreamingMessageBody({ text }: { text: string }) {
  const [displayLength, setDisplayLength] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const displayLengthRef = useRef(0);
  const targetLengthRef = useRef(text.length);
  const textRef = useRef(text);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const lastSourceUpdateAtRef = useRef<number | null>(null);
  const sourceCharsPerSecRef = useRef(STREAMING_MIN_CHARS_PER_SEC);
  const previousTargetLengthRef = useRef(text.length);
  const renderCharsPerSecRef = useRef(STREAMING_MIN_CHARS_PER_SEC);
  const frameCarryRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setPrefersReducedMotion(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    displayLengthRef.current = displayLength;
  }, [displayLength]);

  const stopStreamingFrame = useEffectEvent(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastFrameTimeRef.current = null;
    frameCarryRef.current = 0;
  });

  const syncDisplayLength = useEffectEvent((nextLength: number) => {
    if (nextLength === displayLengthRef.current) {
      return;
    }
    displayLengthRef.current = nextLength;
    setDisplayLength(nextLength);
  });

  const advanceStreamingFrame = useEffectEvent((timestamp: number) => {
    if (lastFrameTimeRef.current === null) {
      lastFrameTimeRef.current = timestamp;
    }

    const elapsedMs = Math.max(
      1,
      Math.min(STREAMING_FRAME_MAX_DELTA_MS, timestamp - lastFrameTimeRef.current),
    );
    lastFrameTimeRef.current = timestamp;

    const currentLength = displayLengthRef.current;
    const targetLength = targetLengthRef.current;
    const sourceIdleMs =
      lastSourceUpdateAtRef.current === null ? Number.POSITIVE_INFINITY : timestamp - lastSourceUpdateAtRef.current;
    const baseBufferChars = clampNumber(
      Math.round((sourceCharsPerSecRef.current * STREAMING_BUFFER_WINDOW_MS) / 1000),
      STREAMING_MIN_BUFFER_CHARS,
      STREAMING_MAX_BUFFER_CHARS,
    );
    const desiredBufferChars = resolveBufferedChars(baseBufferChars, sourceIdleMs);
    const releaseTargetLength =
      targetLength <= currentLength
        ? currentLength
        : clampNumber(
            Math.max(currentLength + 1, targetLength - desiredBufferChars),
            currentLength + 1,
            targetLength,
          );
    const backlog = releaseTargetLength - currentLength;
    if (backlog <= 0) {
      if (targetLength <= currentLength) {
        stopStreamingFrame();
        return;
      }
      frameRef.current = requestAnimationFrame(advanceStreamingFrame);
      return;
    }

    const desiredCharsPerSec = Math.min(
      STREAMING_MAX_CHARS_PER_SEC,
      STREAMING_MIN_CHARS_PER_SEC + Math.max(0, backlog - STREAMING_TARGET_BACKLOG) * STREAMING_BACKLOG_GAIN,
    );
    renderCharsPerSecRef.current = blendNumber(
      renderCharsPerSecRef.current,
      desiredCharsPerSec,
      STREAMING_SPEED_SMOOTHING,
    );
    frameCarryRef.current += (renderCharsPerSecRef.current * elapsedMs) / 1000;
    const step = Math.min(
      backlog,
      STREAMING_MAX_CHARS_PER_FRAME,
      Math.max(1, Math.floor(frameCarryRef.current)),
    );
    frameCarryRef.current = Math.max(0, frameCarryRef.current - step);

    const nextLength = normalizeStreamingLength(
      textRef.current,
      Math.min(releaseTargetLength, currentLength + step),
    );

    syncDisplayLength(nextLength);
    if (nextLength >= targetLengthRef.current) {
      stopStreamingFrame();
      return;
    }

    frameRef.current = requestAnimationFrame(advanceStreamingFrame);
  });

  const ensureStreamingFrame = useEffectEvent(() => {
    if (frameRef.current !== null) {
      return;
    }
    lastFrameTimeRef.current = null;
    frameRef.current = requestAnimationFrame(advanceStreamingFrame);
  });

  useEffect(() => {
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    const previousTargetLength = previousTargetLengthRef.current;
    const addedChars = Math.max(0, text.length - previousTargetLength);
    if (addedChars > 0) {
      const lastSourceUpdateAt = lastSourceUpdateAtRef.current;
      if (lastSourceUpdateAt !== null) {
        const deltaMs = Math.max(1, now - lastSourceUpdateAt);
        const measuredCharsPerSec = clampNumber(
          (addedChars * 1000) / deltaMs,
          STREAMING_MIN_CHARS_PER_SEC,
          STREAMING_MAX_CHARS_PER_SEC * 2,
        );
        sourceCharsPerSecRef.current = blendNumber(
          sourceCharsPerSecRef.current,
          measuredCharsPerSec,
          STREAMING_SOURCE_SPEED_SMOOTHING,
        );
      }
      lastSourceUpdateAtRef.current = now;
    }

    textRef.current = text;
    targetLengthRef.current = text.length;
    previousTargetLengthRef.current = text.length;

    if (prefersReducedMotion) {
      stopStreamingFrame();
      syncDisplayLength(text.length);
      return;
    }

    if (displayLengthRef.current > text.length) {
      stopStreamingFrame();
      syncDisplayLength(text.length);
      return;
    }

    if (displayLengthRef.current === text.length) {
      return;
    }

    // Keep the visual stream tied to the browser frame clock instead of backend delta cadence.
    ensureStreamingFrame();
  }, [prefersReducedMotion, text]);

  useEffect(() => () => stopStreamingFrame(), []);

  const displayText = normalizeAssistantMarkdown(text.slice(0, displayLength));
  const { stableMarkdown, trailingText } = splitStreamingMarkdownForRender(displayText);

  if (!stableMarkdown) {
    return <div className={STREAMING_PLAIN_TEXT_CLASS}>{trailingText}</div>;
  }

  return (
    <div className="min-w-0">
      <MarkdownContent text={stableMarkdown} highlight={false} />
      {trailingText ? (
        <div className={STREAMING_PLAIN_TEXT_CLASS}>{trailingText}</div>
      ) : null}
    </div>
  );
}

function normalizeStreamingLength(text: string, nextLength: number) {
  if (nextLength <= 0 || nextLength >= text.length) {
    return nextLength;
  }

  const previousCodeUnit = text.charCodeAt(nextLength - 1);
  if (previousCodeUnit >= 0xd800 && previousCodeUnit <= 0xdbff) {
    return nextLength + 1;
  }

  return nextLength;
}

function blendNumber(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveBufferedChars(baseBufferChars: number, sourceIdleMs: number) {
  if (!Number.isFinite(sourceIdleMs)) {
    return baseBufferChars;
  }

  if (sourceIdleMs <= STREAMING_BUFFER_HOLD_IDLE_MS) {
    return baseBufferChars;
  }

  const decayProgress = clampNumber(
    (sourceIdleMs - STREAMING_BUFFER_HOLD_IDLE_MS) / STREAMING_BUFFER_DECAY_MS,
    0,
    1,
  );

  return Math.round(baseBufferChars * (1 - decayProgress));
}
