import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, History, Loader2 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { AdminCeremonyPurchaseRequests } from './AdminCeremonyPurchaseRequests';
import type { CeremonyPlanHistorySummary, CeremonyStatus, CeremonySummary } from '../types';

const STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '준비 중(플랜 미확정)',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

/**
 * 플랫폼 관리자용 "행사 이력" 화면(신규) — 파트너사의 특정 행사 하나를 골라 플랜 선택 이력과
 * 단위 상품 구매 이력을 한 화면에서 함께 본다(signstage-docs
 * business/unit-product-purchase-self-checkout-review.md 8.6절 결정, 2026-09-11 — 조직
 * 상세에 붙이는 안과 별도 화면을 새로 만드는 안 중 후자로 확정했다). 관리자 쪽엔 그동안
 * "행사 상세" 개념 자체가 없었다 — 이 화면이 처음이다.
 *
 * <p>진입 경로: `AdminOrganizationDetail.tsx`의 가벼운 행사 목록에서 "이력 보기" 링크로
 * 들어온다. 구매 이력은 기존 승인 큐 화면(`AdminCeremonyPurchaseRequests`)을 `ceremonyId`
 * prop으로 이 행사에 좁혀 그대로 재사용한다 — 두 화면은 같은 백엔드 조회를 범위만 다르게
 * (조직 전체 vs 이 행사 하나) 쓴다. 통계·집계는 범위 밖이다(추후 별도 요청).
 */
export const AdminCeremonyHistory: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [isCeremonyLoading, setIsCeremonyLoading] = useState(true);
  const [planHistory, setPlanHistory] = useState<CeremonyPlanHistorySummary[]>([]);
  const [isPlanHistoryLoading, setIsPlanHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/organizations/${organizationId}/ceremonies/${ceremonyId}`);
        if (!cancelled) setCeremony(response.data as CeremonySummary);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '행사를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsCeremonyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/platform-admin/organizations/${organizationId}/ceremonies/${ceremonyId}/plan-history`);
        if (!cancelled) setPlanHistory(response.data as CeremonyPlanHistorySummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '플랜 선택 이력을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsPlanHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  return (
    <div className="space-y-8">
      <Link
        to={`/admin/organizations/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950"
      >
        <ArrowLeft size={14} />
        조직 상세로
      </Link>

      {isCeremonyLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : !ceremony ? (
        <p className="text-sm text-gray-400">행사를 찾을 수 없습니다.</p>
      ) : (
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <History size={20} className="text-gray-400" />
            {ceremony.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{STATUS_LABEL[ceremony.status]} · 이 행사의 플랜 선택 이력과 구매 이력입니다.</p>
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">플랜 선택 이력</h2>
        {isPlanHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : planHistory.length === 0 ? (
          <p className="text-sm text-gray-500">플랜 선택 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {planHistory.map((history) => {
              const subtotal = history.lines.reduce((sum, line) => sum + line.snapshotSalePrice * line.includedQuantity, 0);
              const findQty = (type: string) => history.lines.find((line) => line.unitProductType === type)?.includedQuantity ?? 0;
              return (
                <li key={history.id} className="py-2">
                  <p className="text-sm text-gray-950 font-medium">{history.planName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatCurrency(subtotal, history.lines[0]?.currencyCode ?? 'KRW')} · 서명자 {findQty('SIGNERS')}명 · 템플릿{' '}
                    {findQty('TEMPLATES')}건 · 테스트 {findQty('TEST_EVENTS')}건 · 본행사 {findQty('MAIN_EVENTS')}건
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(history.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3">구매 이력</h2>
        {ceremonyId && <AdminCeremonyPurchaseRequests ceremonyId={Number(ceremonyId)} />}
      </section>
    </div>
  );
};
