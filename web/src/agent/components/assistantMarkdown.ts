export function normalizeAssistantMarkdown(text: string) {
  if (!text) {
    return text;
  }

  const lines = text.split('\n');
  const normalized: string[] = [];
  let inFence = false;
  let fenceChar = '';
  let skippingSeparatorPadding = false;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const currentFenceChar = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = currentFenceChar;
      } else if (currentFenceChar === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
      skippingSeparatorPadding = false;
      normalized.push(line);
      continue;
    }

    if (!inFence && isStandaloneSeparator(line)) {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== '') {
        normalized.push('');
      }
      skippingSeparatorPadding = true;
      continue;
    }

    if (skippingSeparatorPadding && line.trim() === '') {
      continue;
    }

    skippingSeparatorPadding = false;
    normalized.push(line);
  }

  return normalized.join('\n');
}

function isStandaloneSeparator(line: string) {
  const trimmed = line.trim();
  return /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed);
}
