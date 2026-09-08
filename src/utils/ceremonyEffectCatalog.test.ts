import { describe, expect, it } from 'vitest';
import {
  COMPLETION_EFFECT_CATALOG,
  intersectDefinitionsWithRegistry,
  normalizeCompletionEffect,
  normalizeSignatureEffect,
  resolveCompletionEffectTargetType,
  resolveSignatureEffectTargetType,
  SIGNATURE_EFFECT_CATALOG,
} from './ceremonyEffectCatalog';
import type { CeremonyEffectDefinition } from '../types';

/**
 * signstage-backend `V202609071100__seed_and_backfill_ceremony_event_effects.sql`이 심는
 * 값과 이 로컬 카탈로그가 어긋나지 않는지 고정한다 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-CORE-01.
 */
describe('ceremonyEffectCatalog matches the backend seed', () => {
  it('signature effect catalog matches SIGNER_FIELD_ZOOM seed rows (id 10, display_order 10/20/30/40)', () => {
    expect(SIGNATURE_EFFECT_CATALOG.HIGHLIGHT.rendererKey).toBe('projector-signature-highlight');
    expect(SIGNATURE_EFFECT_CATALOG.PULSE.rendererKey).toBe('projector-signature-pulse');
    expect(SIGNATURE_EFFECT_CATALOG.RIPPLE.rendererKey).toBe('projector-signature-ripple');
    expect(SIGNATURE_EFFECT_CATALOG.FLASH.rendererKey).toBe('projector-signature-flash');
    Object.values(SIGNATURE_EFFECT_CATALOG).forEach(effect => {
      if (effect.code === 'NONE') return;
      expect(effect.targetType).toBe('PROJECTOR');
      expect(effect.triggerType).toBe('SIGNATURE_COMPLETED');
    });
  });

  it('completion effect catalog matches ALL_SIGNED_FIREWORKS seed rows (id 11, display_order 10~50)', () => {
    expect(COMPLETION_EFFECT_CATALOG.CONFETTI.rendererKey).toBe('projector-confetti');
    expect(COMPLETION_EFFECT_CATALOG.FIREWORKS.rendererKey).toBe('projector-fireworks');
    expect(COMPLETION_EFFECT_CATALOG.SPARKLE.rendererKey).toBe('projector-sparkle');
    expect(COMPLETION_EFFECT_CATALOG.AIR_SHOT.rendererKey).toBe('projector-air-shot');
    expect(COMPLETION_EFFECT_CATALOG.PAPER_REEL.rendererKey).toBe('projector-paper-reel');
    Object.values(COMPLETION_EFFECT_CATALOG).forEach(effect => {
      if (effect.code === 'NONE') return;
      expect(effect.targetType).toBe('PROJECTOR');
      expect(effect.triggerType).toBe('ALL_SIGNATURES_COMPLETED');
      // 백엔드 seed는 완료 효과 5종 전부 manually_triggerable=1로 심는다(BE-CATALOG-03 contract).
      expect(effect.manuallyTriggerable).toBe(true);
    });
  });

  it('falls back to NONE for unknown effect codes', () => {
    expect(normalizeSignatureEffect('UNKNOWN')).toBe('NONE');
    expect(normalizeSignatureEffect(undefined)).toBe('NONE');
    expect(normalizeCompletionEffect('UNKNOWN')).toBe('NONE');
    expect(normalizeCompletionEffect(null)).toBe('NONE');
  });
});

describe('resolveSignatureEffectTargetType / resolveCompletionEffectTargetType', () => {
  const serverDefinition = (overrides: Partial<CeremonyEffectDefinition>): CeremonyEffectDefinition => ({
    id: 1,
    code: 'HIGHLIGHT',
    targetType: 'PROJECTOR',
    triggerType: 'SIGNATURE_COMPLETED',
    optionalFeatureIds: [10],
    displayName: '하이라이트',
    description: null,
    rendererKey: 'projector-signature-highlight',
    enabled: true,
    userVisible: true,
    manuallyTriggerable: false,
    displayOrder: 10,
    configJson: null,
    createdAt: '2026-09-07T00:00:00',
    ...overrides,
  });

  it('prefers the server definition targetType when present', () => {
    const definitions = [serverDefinition({ targetType: 'SIGNER' })];
    expect(resolveSignatureEffectTargetType(definitions, 'HIGHLIGHT')).toBe('SIGNER');
  });

  it('falls back to the local catalog when no server definition matches', () => {
    expect(resolveSignatureEffectTargetType(null, 'HIGHLIGHT')).toBe('PROJECTOR');
    expect(resolveSignatureEffectTargetType([], 'PULSE')).toBe('PROJECTOR');
  });

  it('does the same for completion effects', () => {
    const definitions = [serverDefinition({
      code: 'FIREWORKS', triggerType: 'ALL_SIGNATURES_COMPLETED', targetType: 'SIGNER',
    })];
    expect(resolveCompletionEffectTargetType(definitions, 'FIREWORKS')).toBe('SIGNER');
    expect(resolveCompletionEffectTargetType(undefined, 'FIREWORKS')).toBe('PROJECTOR');
  });
});

describe('intersectDefinitionsWithRegistry', () => {
  it('keeps only definitions whose code exists in the local registry', () => {
    const definitions: CeremonyEffectDefinition[] = [
      { id: 1, code: 'HIGHLIGHT', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', optionalFeatureIds: [10], displayName: '하이라이트', description: null, rendererKey: 'projector-signature-highlight', enabled: true, userVisible: true, manuallyTriggerable: false, displayOrder: 10, configJson: null, createdAt: '2026-09-07T00:00:00' },
      { id: 2, code: 'NOT_YET_SHIPPED', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', optionalFeatureIds: [10], displayName: '아직 없음', description: null, rendererKey: 'projector-not-yet-shipped', enabled: true, userVisible: true, manuallyTriggerable: false, displayOrder: 20, configJson: null, createdAt: '2026-09-07T00:00:00' },
    ];
    const registry = { HIGHLIGHT: {} };

    expect(intersectDefinitionsWithRegistry(definitions, registry)).toEqual([definitions[0]]);
  });

  it('returns an empty array when nothing in the registry matches', () => {
    const definitions: CeremonyEffectDefinition[] = [
      { id: 1, code: 'UNKNOWN', targetType: 'PROJECTOR', triggerType: 'SIGNATURE_COMPLETED', optionalFeatureIds: [10], displayName: '?', description: null, rendererKey: 'x', enabled: true, userVisible: true, manuallyTriggerable: false, displayOrder: 10, configJson: null, createdAt: '2026-09-07T00:00:00' },
    ];
    expect(intersectDefinitionsWithRegistry(definitions, {})).toEqual([]);
  });
});
