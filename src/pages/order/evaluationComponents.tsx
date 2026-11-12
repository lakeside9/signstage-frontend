import type { FC } from 'react';
import type { PartnerEvaluation } from '../../types';

/** 수락률(수락/거절/만료). 응답한 발주가 없으면 '-'. */
export const AcceptanceRate: FC<{ evaluation: PartnerEvaluation }> = ({ evaluation }) => (
  <>
    <span className="tabular-nums">
      {evaluation.acceptanceRatePercent !== null ? `${evaluation.acceptanceRatePercent}%` : '-'}
    </span>
    <p className="text-xs text-gray-400 tabular-nums">
      수락 {evaluation.acceptedCount} · 거절 {evaluation.rejectedCount} · 만료 {evaluation.expiredCount}
    </p>
  </>
);

/** 평균 수행 평점(입력 건수). 입력이 없으면 '-'. */
export const AverageRating: FC<{ evaluation: PartnerEvaluation }> = ({ evaluation }) => (
  <>
    <span className="tabular-nums">{evaluation.averageRating !== null ? `${evaluation.averageRating}/5` : '-'}</span>
    {evaluation.ratedCount > 0 && <p className="text-xs text-gray-400">{evaluation.ratedCount}건 평가</p>}
  </>
);
