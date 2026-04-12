import type { ReasoningEffort, WebSearchConfig } from './types';

export const reasoningOptions: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'none', label: '关闭' },
  { value: 'minimal', label: '最低' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' },
];

export const webSearchModeLabels: Record<WebSearchConfig['toolMode'], string> = {
  builtin: '模型原生搜索',
  tavily: 'Tavily',
  exa: 'Exa',
};

export type WebSearchSelectValue = 'off' | WebSearchConfig['toolMode'];

export const webSearchSelectLabels: Record<WebSearchSelectValue, string> = {
  off: '关闭联网',
  ...webSearchModeLabels,
};
