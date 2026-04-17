import { memo, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { MarkdownContent } from './MarkdownContent';
import { STREAMING_PLAIN_TEXT_CLASS } from './MarkdownContent.styles';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingBlock } from './ThinkingBlock';
import type { AgentMessage } from '../sessionStore';

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
    return (
      <article className="space-y-2">
        <div className="ml-auto w-fit max-w-[90%] rounded-full border border-border bg-accent px-4 py-2.5 text-sm leading-7 text-accentForeground">
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="space-y-4 min-w-0 overflow-hidden">
      <ThinkingBlock
        text={message.thinking}
        isGenerating={generating}
        hasText={message.text.trim().length > 0}
        durationSec={message.thinkingDurationSec}
      />
      {message.toolEvents.length > 0 ? (
        <div className="space-y-2 min-w-0">
          {message.toolEvents.map((event) => (
            <ToolCallCard key={event.id} event={event} />
          ))}
        </div>
      ) : null}
      {message.text.trim() ? (
        <MessageBody text={message.text} isStreaming={generating} />
      ) : null}
      {message.error ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-mutedForeground">
          {message.error}
        </div>
      ) : null}
    </article>
  );
});

function MessageBody({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  if (isStreaming) {
    return <StreamingMessageBody text={text} />;
  }

  return <CompletedMessageBody text={text} />;
}

function CompletedMessageBody({ text }: { text: string }) {
  const deferredText = useDeferredValue(text);

  return <MarkdownContent text={deferredText} />;
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

  const displayText = text.slice(0, displayLength);
  const { stableMarkdown, trailingText } = useMemo(
    () => partitionStreamingMarkdown(displayText),
    [displayText],
  );

  return (
    <div className="min-w-0 space-y-0">
      {stableMarkdown ? <MarkdownContent text={stableMarkdown} /> : null}
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

function partitionStreamingMarkdown(text: string) {
  if (!text) {
    return {
      stableMarkdown: '',
      trailingText: '',
    };
  }

  let cursor = 0;
  let lastStableIndex = 0;
  let inFence = false;
  let fenceMarker = '';
  let inList = false;
  let listItemCount = 0;
  let inQuote = false;
  let inTable = false;
  let previousLineContent = '';
  let previousLineHadNewline = false;

  while (cursor < text.length) {
    const newlineIndex = text.indexOf('\n', cursor);
    const nextCursor = newlineIndex === -1 ? text.length : newlineIndex + 1;
    const line = text.slice(cursor, nextCursor);
    const lineContent = line.endsWith('\n') ? line.slice(0, -1) : line;
    const hasNewline = line.endsWith('\n');
    const trimmedLine = lineContent.trim();
    const fenceMatch = lineContent.match(/^\s*(```+|~~~+)/);

    if (!inFence && fenceMatch) {
      if (cursor > lastStableIndex) {
        lastStableIndex = cursor;
      }
      inList = false;
      listItemCount = 0;
      inQuote = false;
      inTable = false;
      inFence = true;
      fenceMarker = fenceMatch[1][0];
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (inFence) {
      if (fenceMatch && fenceMatch[1][0] === fenceMarker) {
        inFence = false;
        fenceMarker = '';
        lastStableIndex = nextCursor;
      }
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (trimmedLine === '') {
      lastStableIndex = nextCursor;
      inList = false;
      listItemCount = 0;
      inQuote = false;
      inTable = false;
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (inTable) {
      if (looksLikeTableRow(lineContent) && hasNewline) {
        lastStableIndex = nextCursor;
        cursor = nextCursor;
        previousLineContent = lineContent;
        previousLineHadNewline = hasNewline;
        continue;
      }

      lastStableIndex = cursor;
      inTable = false;
    }

    if (
      isTableDelimiter(lineContent) &&
      previousLineHadNewline &&
      looksLikeTableRow(previousLineContent)
    ) {
      lastStableIndex = nextCursor;
      inList = false;
      listItemCount = 0;
      inQuote = false;
      inTable = true;
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (isListItem(lineContent)) {
      if (!inList && cursor > lastStableIndex) {
        lastStableIndex = cursor;
      } else if (inList && listItemCount > 0) {
        lastStableIndex = cursor;
      }

      inList = true;
      listItemCount += 1;
      inQuote = false;
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (inList) {
      if (isListContinuationLine(lineContent)) {
        cursor = nextCursor;
        previousLineContent = lineContent;
        previousLineHadNewline = hasNewline;
        continue;
      }

      lastStableIndex = cursor;
      inList = false;
      listItemCount = 0;
    }

    if (isQuoteLine(lineContent)) {
      if (!inQuote && cursor > lastStableIndex) {
        lastStableIndex = cursor;
      }

      inQuote = true;
      cursor = nextCursor;
      previousLineContent = lineContent;
      previousLineHadNewline = hasNewline;
      continue;
    }

    if (inQuote) {
      lastStableIndex = cursor;
      inQuote = false;
    }

    if (hasNewline && (isHorizontalRule(lineContent) || isStandaloneHeading(lineContent))) {
      lastStableIndex = nextCursor;
    }

    cursor = nextCursor;
    previousLineContent = lineContent;
    previousLineHadNewline = hasNewline;
  }

  return {
    stableMarkdown: text.slice(0, lastStableIndex),
    trailingText: text.slice(lastStableIndex),
  };
}

function isHorizontalRule(line: string) {
  return /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isStandaloneHeading(line: string) {
  return /^\s{0,3}#{1,6}\s+\S/.test(line);
}

function isListItem(line: string) {
  return /^\s{0,3}(?:[-+*]|\d+[.)])\s+\S/.test(line);
}

function isListContinuationLine(line: string) {
  return /^(?:\s{2,}|\t+)\S/.test(line);
}

function isQuoteLine(line: string) {
  return /^\s{0,3}>\s?.*$/.test(line);
}

function looksLikeTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes('|')) {
    return false;
  }

  const cellCount = trimmed
    .replace(/^\||\|$/g, '')
    .split('|')
    .filter((cell) => cell.trim().length > 0).length;

  return cellCount >= 2;
}

function isTableDelimiter(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }

  return /^\|?(?:\s*:?-{3,}:?\s*\|)+(?:\s*:?-{3,}:?\s*)?$/.test(trimmed);
}
