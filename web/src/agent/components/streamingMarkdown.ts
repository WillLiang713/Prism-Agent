export function splitStreamingMarkdownForRender(text: string) {
  return partitionStreamingMarkdown(text);
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
