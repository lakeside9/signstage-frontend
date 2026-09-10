import type { FC } from 'react';
import type { CeremonyEventType } from '../types';

interface EventWatermarkProps {
  eventType: CeremonyEventType;
  /** 이 행사의 조직이 데모 조직인가. */
  isDemo: boolean;
}

/**
 * 전시용 화면·서명자 포털 전체에 깔리는 반투명 대각선 워터마크 — signstage-docs
 * business/demo-account-exhibition-signer-preview-review.md 6.1절 결정(2026-09-10 구현).
 * 조건은 `eventType !== 'MAIN' || isDemo`(데모/테스트/리허설 서명이 진짜처럼 보이는 위험을
 * 줄인다). 문구 우선순위는 `DEMO > REHEARSAL > TEST` — 데모 조직의 TEST/REHEARSAL 이벤트처럼
 * 겹칠 수 있는 경우 DEMO를 우선한다.
 *
 * `mix-blend-mode: difference`로 배경색과 무관하게(전시 화면의 어두운 배경, 서명자 포털의
 * 밝은 배경 둘 다) 항상 또렷하게 보이게 한다 — 별도로 화면마다 색을 맞출 필요가 없다.
 */
export const EventWatermark: FC<EventWatermarkProps> = ({ eventType, isDemo }) => {
  const text = isDemo ? 'DEMO' : eventType === 'REHEARSAL' ? 'REHEARSAL' : eventType === 'TEST' ? 'TEST' : null;
  if (!text) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-[-25%] flex flex-wrap content-around justify-around gap-x-16 gap-y-10"
        style={{ transform: 'rotate(-28deg)' }}
      >
        {Array.from({ length: 48 }).map((_, index) => (
          <span
            key={index}
            className="whitespace-nowrap text-5xl font-black tracking-[0.2em] text-white"
            style={{ mixBlendMode: 'difference', opacity: 0.5 }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};
