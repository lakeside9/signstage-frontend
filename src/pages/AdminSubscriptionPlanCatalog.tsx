import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { PeriodStatusBadge } from './billingCatalog/components';
import type { BillingPlanSummary } from '../types';

/**
 * 구독형 플랜만 걸러 보여주는 카탈로그 화면(`/admin/billing-catalog/subscription-plans`) —
 * signstage-docs business/organization-event-discount-pricing-review.md 8.5절 명명. 구독형
 * 플랜도 결국 `BillingPlan`(같은 테이블·같은 등록/수정 화면)이라 별도 CRUD API를 두지 않고,
 * `GET /api/billing-plans`를 그대로 써서 `subscription`이 true인 것만 필터링한다 —
 * `AdminBillingPlanList`와 같은 목록을 다른 렌즈로 보여주는 화면이다. 등록/수정은
 * `AdminBillingPlanCreate`/`Edit`의 "구독형 플랜으로 만들기" 체크박스를 그대로 쓴다.
 */
export const AdminSubscriptionPlanCatalog: FC = () => {
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_BILLING_CATALOG_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/billing-plans');
        if (!cancelled) setPlans((response.data as BillingPlanSummary[]).filter((plan) => plan.subscription));
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '구독 플랜 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <CalendarClock size={20} className="text-gray-400" />
            구독 플랜 카탈로그
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            조직이 신청 → 승인받아야 쓸 수 있는 구독형(N회 이용권) 플랜입니다. 신청 승인/반려는 "구독 요청 관리"에서 합니다.
          </p>
        </div>
        {canManage && (
          <Button to="/admin/billing-catalog/plans/new">
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      <ListContainer isLoading={isLoading} isEmpty={plans.length === 0} emptyMessage="등록된 구독형 플랜이 없습니다.">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              <th className="text-left px-4 py-3 font-medium">구독 유형</th>
              <th className="text-left px-4 py-3 font-medium">기간</th>
              <th className="text-left px-4 py-3 font-medium">허용 횟수</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">사용 건수</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="px-4 py-3 font-medium">
                  <Link to={`/admin/billing-catalog/plans/${plan.id}`} className="text-gray-950 hover:underline">
                    {plan.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {plan.subscriptionType === 'PERIOD_AND_COUNT' ? '기간+횟수' : '횟수제'}
                </td>
                <td className="px-4 py-3 text-gray-600">{plan.subscriptionPeriodMonths ? `${plan.subscriptionPeriodMonths}개월` : '무기한'}</td>
                <td className="px-4 py-3 text-gray-600">{plan.subscriptionAllowedCount}회</td>
                <td className="px-4 py-3">
                  <PeriodStatusBadge status={plan.periodStatus} />
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{plan.usageCount}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
