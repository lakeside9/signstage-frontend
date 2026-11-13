import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Star } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { useClientPagination } from '../utils/useClientPagination';
import { AcceptanceRate, AverageRating } from './order/evaluationComponents';
import { formatMoney } from './order/constants';
import type { PartnerEvaluation } from '../types';

/**
 * 파트너 평가(플랫폼 내부용) — signstage-docs business/platform-order-partner-subcontract-review.md
 * 11장 8단계. 발주 응답(수락률)과 승인된 검수(하자·지체·감액·승인 간주·수행 평점)를 파트너별로
 * 모아 본다. 파트너에게는 보이지 않는다. 발주 가능한 파트너가 먼저 나온다.
 */
export const AdminPartnerEvaluations: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [evaluations, setEvaluations] = useState<PartnerEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pageItems, pagination } = useClientPagination(evaluations);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/partner-evaluations');
        if (!cancelled) setEvaluations(response.data as PartnerEvaluation[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '파트너 평가를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSnackbar]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Star size={20} className="text-gray-400" />
          파트너 평가
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          발주 응답과 검수 결과로 계산합니다. 수행 평점은 검수 승인 때 입력한 값의 평균입니다. 파트너에게는 보이지 않습니다.
        </p>
      </div>

      <ListContainer
        isLoading={isLoading}
        isEmpty={evaluations.length === 0}
        emptyMessage="평가할 파트너가 없습니다."
        pagination={isLoading ? undefined : pagination}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">파트너</th>
              <th className="text-right px-4 py-3 font-medium">발주</th>
              <th className="text-left px-4 py-3 font-medium">수락률</th>
              <th className="text-right px-4 py-3 font-medium">검수 승인</th>
              <th className="text-right px-4 py-3 font-medium">하자·지체</th>
              <th className="text-right px-4 py-3 font-medium">감액</th>
              <th className="text-left px-4 py-3 font-medium">수행 평점</th>
              <th className="text-left px-4 py-3 font-medium">최근 발주</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((evaluation) => (
              <tr key={evaluation.organizationId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="text-gray-950 font-medium">{evaluation.organizationName}</span>
                  {!evaluation.orderEligible && <p className="text-xs text-gray-400">발주 요건 미충족</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{evaluation.issuedCount}</td>
                <td className="px-4 py-3">
                  <AcceptanceRate evaluation={evaluation} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {evaluation.inspectedCount}
                  {evaluation.deemedCount > 0 && <p className="text-xs text-gray-400">승인 간주 {evaluation.deemedCount}</p>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {evaluation.defectCount} · {evaluation.delayCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {evaluation.deductionCount}건
                  {evaluation.deductionTotal > 0 && (
                    <p className="text-xs text-gray-400">{formatMoney(evaluation.deductionTotal)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AverageRating evaluation={evaluation} />
                </td>
                <td className="px-4 py-3 text-gray-500">{evaluation.lastIssuedAt ? formatDateTime(evaluation.lastIssuedAt) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
