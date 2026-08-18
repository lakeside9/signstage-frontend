import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileSignature, Plus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { BillingPlanSummary, CeremonySummary } from '../types';

/**
 * 행사(Ceremony) 목록(`/org/ceremonies/:organizationId`). 백엔드가
 * 페이지네이션 없는 `List<>`를 그대로 반환하므로(UserOrganizationList와 같은 경우)
 * `ListContainer`만 쓰고 `Pagination`은 붙이지 않는다(frontend/list-screen-convention.md).
 *
 * OWNER/ADMIN은 조직의 전체 행사를, OPERATOR는 배정된 행사만 본다(백엔드가 이미 필터링해서
 * 돌려준다 — 프런트는 받은 목록을 그대로 보여주기만 한다).
 */
export const UserCeremonyList: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();

  const [ceremonies, setCeremonies] = useState<CeremonySummary[]>([]);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [ceremoniesRes, plansRes] = await Promise.all([
          api.get(`/organizations/${organizationId}/ceremonies`),
          api.get('/billing-plans'),
        ]);
        if (!cancelled) {
          setCeremonies(ceremoniesRes.data as CeremonySummary[]);
          setPlans(plansRes.data as BillingPlanSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '행사 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const planName = (billingPlanId: number) => plans.find((plan) => plan.id === billingPlanId)?.name ?? `#${billingPlanId}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">행사 관리</h1>
          <p className="mt-1 text-sm text-gray-500">행사 마스터(Ceremony) 목록입니다. 하나의 행사 아래 여러 하위 행사(TEST/MAIN)를 둘 수 있습니다.</p>
        </div>
        <Link
          to={`/org/ceremonies/${organizationId}/new`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus size={16} />
          새 행사
        </Link>
      </div>

      <ListContainer isLoading={isLoading} isEmpty={ceremonies.length === 0} emptyMessage="아직 등록된 행사가 없습니다.">
        <ul className="divide-y divide-gray-100">
          {ceremonies.map((ceremony) => (
            <li key={ceremony.id}>
              <Link
                to={`/org/ceremonies/${organizationId}/${ceremony.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <FileSignature size={16} className="text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-950 truncate">{ceremony.title}</p>
                  <p className="text-xs text-gray-500">플랜: {planName(ceremony.billingPlanId)}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">
                  {new Date(ceremony.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </ListContainer>
    </div>
  );
};
