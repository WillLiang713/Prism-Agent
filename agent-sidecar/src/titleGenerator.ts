import type { AgentSessionMessage, ProviderSelection } from './types.js';

export interface TitleModelPayload {
  providerSelection?: string;
  provider?: string;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
}

const TITLE_SYSTEM_PROMPT = '你是一个标题生成助手。只输出标题本身，不要任何解释、引号或标点结尾。';
const ANTHROPIC_VERSION = '2023-06-01';

export function isTitleConfigUsable(config: TitleModelPayload | null | undefined): boolean {
  if (!config) return false;
  if (!config.model?.trim()) return false;
  if (!config.apiUrl?.trim() && !config.apiKey?.trim()) return false;
  return true;
}

export async function generateTitleFromMessages(
  messages: AgentSessionMessage[],
  config: TitleModelPayload,
): Promise<string | null> {
  if (!isTitleConfigUsable(config)) return null;

  const prompt = buildPrompt(messages);
  if (!prompt) return null;

  const selection = resolveProviderSelection(config);
  if (!selection) return null;

  try {
    switch (selection) {
      case 'openai_chat':
        return await generateWithOpenAIChat(config, prompt);
      case 'openai_responses':
        return await generateWithOpenAIResponses(config, prompt);
      case 'anthropic':
        return await generateWithAnthropic(config, prompt);
      case 'gemini':
        return await generateWithGemini(config, prompt);
      default:
        return null;
    }
  } catch (error) {
    console.warn('[titleGenerator] request error:', error);
    return null;
  }
}

function buildPrompt(messages: AgentSessionMessage[]) {
  const userMsg = messages.find((message) => message.role === 'user' && message.text.trim());
  const assistantMsg = messages.find(
    (message) => message.role === 'assistant' && message.text.trim(),
  );
  if (!userMsg) return '';

  const userText = userMsg.text.slice(0, 500);
  const assistantText = assistantMsg ? assistantMsg.text.slice(0, 500) : '';
  return `根据以下对话提炼一个不超过 12 个汉字的中文标题，直接输出标题本身，不要引号和结尾标点。\n\n用户消息：\n${userText}${assistantText ? `\n\n助手回复：\n${assistantText}` : ''}`;
}

function resolveProviderSelection(config: TitleModelPayload): ProviderSelection | null {
  const rawSelection = config.providerSelection?.trim();
  if (
    rawSelection === 'openai_chat' ||
    rawSelection === 'openai_responses' ||
    rawSelection === 'anthropic' ||
    rawSelection === 'gemini'
  ) {
    return rawSelection;
  }

  if (rawSelection === 'responses') {
    return 'openai_responses';
  }

  if (rawSelection === 'chat_completions') {
    if (config.provider === 'anthropic') return 'anthropic';
    if (config.provider === 'gemini') return 'gemini';
    return 'openai_chat';
  }

  if (config.provider === 'anthropic') return 'anthropic';
  if (config.provider === 'gemini') return 'gemini';
  if (config.provider === 'openai') return 'openai_chat';
  return null;
}

async function generateWithOpenAIChat(config: TitleModelPayload, prompt: string) {
  const endpoint = buildOpenAIChatEndpoint(config.apiUrl || '');
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAIHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 40,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    console.warn(
      '[titleGenerator] openai chat failed:',
      response.status,
      await safeText(response),
    );
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  return cleanTitle(extractOpenAIChatText(data));
}

async function generateWithOpenAIResponses(config: TitleModelPayload, prompt: string) {
  const endpoint = buildOpenAIResponsesEndpoint(config.apiUrl || '');
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildOpenAIHeaders(config),
    body: JSON.stringify({
      model: config.model,
      input: [
        { role: 'developer', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.warn(
      '[titleGenerator] openai responses failed:',
      response.status,
      await safeText(response),
    );
    return null;
  }

  const data = (await response.json()) as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
  return cleanTitle(extractOpenAIResponsesText(data));
}

async function generateWithAnthropic(config: TitleModelPayload, prompt: string) {
  const endpoint = buildAnthropicEndpoint(config.apiUrl || '');
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildAnthropicHeaders(config),
    body: JSON.stringify({
      model: config.model,
      max_tokens: 40,
      system: TITLE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn(
      '[titleGenerator] anthropic messages failed:',
      response.status,
      await safeText(response),
    );
    return null;
  }

  const data = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
  return cleanTitle(
    data.content
      ?.filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text || '')
      .join(' '),
  );
}

async function generateWithGemini(config: TitleModelPayload, prompt: string) {
  const endpoint = buildGeminiEndpoint(config.apiUrl || '', config.model || '');
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildGeminiHeaders(config),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${TITLE_SYSTEM_PROMPT}\n\n${prompt}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn('[titleGenerator] gemini failed:', response.status, await safeText(response));
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  return cleanTitle(
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .filter(Boolean)
      .join(' '),
  );
}

function buildOpenAIChatEndpoint(apiUrl: string) {
  const trimmed = trimTrailingSlashes(apiUrl);
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

function buildOpenAIResponsesEndpoint(apiUrl: string) {
  const trimmed = trimTrailingSlashes(apiUrl);
  if (!trimmed) return '';
  if (trimmed.endsWith('/responses')) return trimmed;
  return `${trimmed}/responses`;
}

function buildAnthropicEndpoint(apiUrl: string) {
  const trimmed = trimTrailingSlashes(apiUrl);
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1/messages')) return trimmed;
  return `${trimmed}/v1/messages`;
}

function buildGeminiEndpoint(apiUrl: string, model: string) {
  const trimmed = trimTrailingSlashes(apiUrl);
  const normalizedModel = model.trim();
  if (!trimmed || !normalizedModel) return '';
  if (trimmed.includes(':generateContent')) return trimmed;
  if (trimmed.endsWith('/models')) {
    return `${trimmed}/${encodeURIComponent(normalizedModel)}:generateContent`;
  }
  return `${trimmed}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function buildOpenAIHeaders(config: TitleModelPayload) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey?.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

function buildAnthropicHeaders(config: TitleModelPayload) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': ANTHROPIC_VERSION,
  };
  if (config.apiKey?.trim()) {
    headers['x-api-key'] = config.apiKey.trim();
  }
  return headers;
}

function buildGeminiHeaders(config: TitleModelPayload) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey?.trim()) {
    headers['x-goog-api-key'] = config.apiKey.trim();
  }
  return headers;
}

function extractOpenAIChatText(data: {
  choices?: Array<{ message?: { content?: unknown } }>;
}) {
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        if ('text' in item && typeof item.text === 'string') return item.text;
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function extractOpenAIResponsesText(data: {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }

  return (
    data.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text || '')
      .join(' ') || ''
  );
}

function cleanTitle(raw: string | null | undefined) {
  return (raw || '')
    .trim()
    .replace(/^["'「『`]+/, '')
    .replace(/["'」』`。．.]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 30);
}

async function safeText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
