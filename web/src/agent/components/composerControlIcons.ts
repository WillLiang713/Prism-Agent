import { Brain, Layers, type LucideIcon } from 'lucide-react';

export const composerControlIcons: Record<'model' | 'reasoning', LucideIcon> = {
  model: Layers,
  reasoning: Brain,
};

export const composerControlIconNames = {
  model: 'layers',
  reasoning: 'brain',
} as const;
