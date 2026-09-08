import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Tag } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type {
  CapacityType,
  DiscountType,
  OrganizationBillingPlanDiscountSummary,
  OrganizationCapacityAddOnDiscountSummary,
  OrganizationDiscountPeriodStatus,
  OrganizationOptionalFeatureDiscountSummary,
  PageResponse,
} from '../types';

const PAGE_SIZE = 20;

type ItemType = 'plan' | 'optional-feature' | 'capacity-addon';

const TABS: Array<{ value: ItemType; label: string }> = [
  { value: 'plan', label: '과금 플랜' },
  { value: 'optional-feature', label: '선택옵션' },
  { value: 'capacity-addon', label: '용량 추가구매' },
];

const CAPACITY_TYPE_LABEL: Record<CapacityType, string> = {
  SIGNERS: '서명자',
  TEMPLATES: '템플릿',
  TEST_EVENTS: '테스트 행사',
  REHEARSAL_EVENTS: '리허설 행사',
  MAIN_EVENTS: '본행사',
  TABLETS: '태블릿',
  ONSITE_SUPPORT: '현장지원',
  ONLINE_SUPPORT: '온라인지원',
};

const STATUS_LABEL: Record<OrganizationDiscountPeriodStatus, string> = {
  PENDING: '예정',
  ACTIVE: '적용 중',
  EXPIRED: '만료됨',
};

const STATUS_CLASS: Record<OrganizationDiscountPeriodStatus, string> = {
  PENDING: 'bg-blue-50 text-blue-600 border-blue-200',
  ACTIVE: 'bg-green-50 text-green-600 border-green-200',
  EXPIRED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatCurrency(discountValue);

/** 세 종류(플랜/선택옵션/용량추가구매) 응답을 한 테이블로 그리기 위한 공통 행 모양. */
interface OverrideRow {
  id: number;
  organizationId: number;
  organizationName: string;
  itemId: number;
  itemLabel: string;
  discountType: DiscountType;
  discountValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: OrganizationDiscountPeriodStatus;
}

const toPlanRow = (d: OrganizationBillingPlanDiscountSummary): OverrideRow => ({
  id: d.id,
  organizationId: d.organizationId,
  organizationName: d.organizationName,
  itemId: d.billingPlanId,
  itemLabel: d.billingPlanName,
  discountType: d.discountType,
  discountValue: d.discountValue,
  effectiveFrom: d.effectiveFrom,
  effectiveTo: d.effectiveTo,
  status: d.status,
});

const toFeatureRow = (d: OrganizationOptionalFeatureDiscountSummary): OverrideRow => ({
  id: d.id,
  organizationId: d.organizationId,
  organizationName: d.organizationName,
  itemId: d.optionalFeatureId,
  itemLabel: d.optionalFeatureName,
  discountType: d.discountType,
  discountValue: d.discountValue,
  effectiveFrom: d.effectiveFrom,
  effectiveTo: d.effectiveTo,
  status: d.status,
});

const toAddOnRow = (d: OrganizationCapacityAddOnDiscountSummary): OverrideRow => ({
  id: d.id,
  organizationId: d.organizationId,
  organizationName: d.organizationName,
  itemId: d.capacityAddOnId,
  itemLabel: `${CAPACITY_TYPE_LABEL[d.capacityType]} +${d.unitAmount}`,
  discountType: d.discountType,
  discountValue: d.discountValue,
  effectiveFrom: d.effectiveFrom,
  effectiveTo: d.effectiveTo,
  status: d.status,
});

const fetchRows = async (tab: ItemType, page: number): Promise<PageResponse<OverrideRow>> => {
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('size', String(PAGE_SIZE));

  if (tab === 'plan') {
    const response = await api.get(`/platform-admin/billing-discounts/plans?${query.toString()}`);
    const raw = response.data as PageResponse<OrganizationBillingPlanDiscountSummary>;
    return { ...raw, content: raw.content.map(toPlanRow) };
  }
  if (tab === 'optional-feature') {
    const response = await api.get(`/platform-admin/billing-discounts/optional-features?${query.toString()}`);
    const raw = response.data as PageResponse<OrganizationOptionalFeatureDiscountSummary>;
    return { ...raw, content: raw.content.map(toFeatureRow) };
  }
  const response = await api.get(`/platform-admin/billing-discounts/capacity-addons?${query.toString()}`);
  const raw = response.data as PageResponse<OrganizationCapacityAddOnDiscountSummary>;
  return { ...raw, content: raw.content.map(toAddOnRow) };
};

/**
 * 파트너별 할인 오버라이드 조직 횡단 목록 — 조직 상세 화면에 묻혀 있던 `OrganizationDiscountPanel`을
 * 분리했다(signstage-docs business/discount-management-screen-separation-review.md 결정
 * #5(2026-09-08)). 조직을 먼저 고르지 않고 전체 조직의 오버라이드 기간을 품목 종류별 탭으로
 * 훑을 수 있다 — 모든 행이 이미 실제 오버라이드라 별도 "있는 것만" 필터는 두지 않는다(6장
 * 결정 #1). 상세(기간 추가/수정/삭제)는 각 행의 "상세" 링크로 별도 화면
 * (`AdminOrganizationDiscountOverrideDetail`)에서 한다.
 */
export const AdminOrganizationDiscountOverrides: FC = () => {
  const [tab, setTab] = useState<ItemType>('plan');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OverrideRow> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await fetchRows(tab, page);
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '오버라이드 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  const rows = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
          <Tag size={18} />
          파트너별 할인 오버라이드
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          특정 조직이 특정 플랜/선택옵션/용량 추가구매를 살 때 카탈로그 할인 대신 적용할 값입니다. 품목당 기간을
          여러 개 둘 수 있고, 겹치지 않는 한 기간별로 다른 할인값을 예약해둘 수 있습니다.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-gray-950 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ListContainer
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyMessage="설정된 오버라이드가 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: setPage,
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">조직</th>
              <th className="text-left px-4 py-3 font-medium">품목</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-left px-4 py-3 font-medium">기간</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/organizations/${row.organizationId}`}
                    className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                  >
                    <Building2 size={14} className="text-gray-400" />
                    {row.organizationName}
                  </Link>
                </td>
                <td className="px-4 py-3 font-medium text-gray-950">{row.itemLabel}</td>
                <td className="px-4 py-3 text-gray-700">{formatDiscount(row.discountType, row.discountValue)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {row.effectiveFrom} ~ {row.effectiveTo ?? '무기한'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_CLASS[row.status]}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/admin/organization-discount-overrides/${row.organizationId}/${tab}/${row.itemId}`}
                    className="text-xs text-gray-500 hover:text-gray-950 hover:underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
    </div>
  );
};
