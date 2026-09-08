import type React from 'react';
import type { AllSignaturesCompleteEffect, SignatureCompleteEffect } from '../../../types';
import { ConfettiEffect } from './ConfettiEffect';
import type {
  CompletionEffectRendererProps,
  SignatureEffectRendererProps,
} from './effectRendererTypes';
import { SignatureFlashEffect } from './SignatureFlashEffect';
import { SignatureHighlightEffect } from './SignatureHighlightEffect';
import { SignaturePulseEffect } from './SignaturePulseEffect';
import { SignatureRippleEffect } from './SignatureRippleEffect';
import { FireworksEffect } from './FireworksEffect';
import { SparkleEffect } from './SparkleEffect';
import { AirShotEffect } from './AirShotEffect';
import { PaperReelEffect } from './PaperReelEffect';

export const signatureEffectRegistry: Partial<
  Record<SignatureCompleteEffect, React.ComponentType<SignatureEffectRendererProps>>
> = {
  HIGHLIGHT: SignatureHighlightEffect,
  PULSE: SignaturePulseEffect,
  RIPPLE: SignatureRippleEffect,
  FLASH: SignatureFlashEffect,
};

export const completionEffectRegistry: Partial<
  Record<AllSignaturesCompleteEffect, React.ComponentType<CompletionEffectRendererProps>>
> = {
  CONFETTI: ConfettiEffect,
  FIREWORKS: FireworksEffect,
  SPARKLE: SparkleEffect,
  AIR_SHOT: AirShotEffect,
  PAPER_REEL: PaperReelEffect,
};
