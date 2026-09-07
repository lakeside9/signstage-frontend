import type { ProjectorEffectPageFrame, TemplateFieldSummary } from '../../../types';

export interface SignatureEffectRendererProps {
  requestId: string;
  signerId: number;
  frames: ProjectorEffectPageFrame[];
  fields: TemplateFieldSummary[];
}

export interface CompletionEffectRendererProps {
  requestId: string;
  portalTarget?: HTMLElement;
}
