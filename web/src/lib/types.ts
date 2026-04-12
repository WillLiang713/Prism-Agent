export type ThemeMode = 'light' | 'dark';

export type ReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export interface PrismImage {
  id: string;
  dataUrl: string;
  name: string;
  size: number;
  type?: string | null;
}

export interface ServiceModelConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  providerSelection:
    | 'openai_chat'
    | 'openai_responses'
    | 'anthropic'
    | 'gemini';
  endpointMode: 'chat_completions' | 'responses';
  apiKey: string;
  model: string;
  modelServiceId: string;
  titleModel: string;
  titleModelServiceId: string;
  apiUrl: string;
  systemPrompt: string;
}

export interface ConnectivityState {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  testedAt: number;
}

export interface ServiceConfig {
  id: string;
  name: string;
  model: ServiceModelConfig;
  reasoningEffort: ReasoningEffort;
  connectivity: ConnectivityState;
  createdAt: number;
  updatedAt: number;
}

export interface RuntimeModelConfig {
  model: string;
  modelServiceId: string;
  titleModel: string;
  titleModelServiceId: string;
  systemPrompt: string;
  reasoningEffort: ReasoningEffort;
}

export interface WebSearchConfig {
  enabled: boolean;
  toolMode: 'tavily' | 'exa' | 'builtin';
  provider: string;
  tavilyApiKey: string;
  exaApiKey: string;
  exaSearchType: string;
  maxResults: number;
  searchDepth: string;
}

export interface DesktopConfig {
  closeToTrayOnClose: boolean;
}

export interface AssistantModelState {
  provider?: string;
  model: string;
  serviceName?: string;
  displayName?: string;
  thinking: string;
  thinkingLabel?: string;
  thinkingComplete?: boolean;
  toolEvents: Record<string, unknown>[];
  webSearchEvents?: Record<string, unknown>[];
  sources: Array<{ title?: string; url: string }>;
  content: string;
  images: Array<{ url: string }>;
  tokens?: number | null;
  timeCostSec?: number | null;
  status: 'ready' | 'loading' | 'complete' | 'error' | 'stopped';
  previewAutoOpened?: boolean;
  thinkingCollapsed?: boolean;
  toolCallsExpanded?: boolean;
}

export interface TopicTurn {
  id: string;
  createdAt: number;
  prompt: string;
  images: PrismImage[];
  webSearch: Record<string, unknown> | null;
  models: {
    main: AssistantModelState;
  };
}

export interface Topic {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: TopicTurn[];
}
