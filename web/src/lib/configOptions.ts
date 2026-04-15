import type { ReasoningEffort } from './types';

export const reasoningOptions: Array<{ value: ReasoningEffort; label: string }> = [
  { value: 'none', label: '关闭' },
  { value: 'minimal', label: '最低' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' },
];
