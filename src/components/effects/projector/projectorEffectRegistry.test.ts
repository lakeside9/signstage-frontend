import { describe, expect, it } from 'vitest';
import {
  COMPLETION_EFFECT_CATALOG,
  normalizeCompletionEffect,
  normalizeSignatureEffect,
  SIGNATURE_EFFECT_CATALOG,
} from '../../../utils/ceremonyEffectCatalog';
import {
  completionEffectRegistry,
  signatureEffectRegistry,
} from './projectorEffectRegistry';

describe('projector effect catalog and registry', () => {
  it('has a renderer for every enabled catalog effect', () => {
    const signatureCodes = Object.keys(SIGNATURE_EFFECT_CATALOG).filter(code => code !== 'NONE');
    const completionCodes = Object.keys(COMPLETION_EFFECT_CATALOG).filter(code => code !== 'NONE');

    expect(Object.keys(signatureEffectRegistry)).toEqual(expect.arrayContaining(signatureCodes));
    expect(Object.keys(completionEffectRegistry)).toEqual(expect.arrayContaining(completionCodes));
  });

  it('falls back to NONE for unknown effect codes', () => {
    expect(normalizeSignatureEffect('UNKNOWN')).toBe('NONE');
    expect(normalizeCompletionEffect('UNKNOWN')).toBe('NONE');
  });
});
