import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Loader2, Plus, Tag } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CapacityType,
  DiscountType,
  OptionalFeatureSummary,
  OrganizationBillingPlanDiscountSummary,
  OrganizationCapacityAddOnDiscountSummary,
  OrganizationDiscountPeriodStatus,
  OrganizationOptionalFeatureDiscountSummary,
  PageResponse,
  PlatformAdminOrganizationSummary,
} from '../types';

const PAGE_SIZE = 20;
/** 서버가 세 종류를 한 쿼리로 합쳐주지 않아 "전체" 선택 시 클라이언트에서 병합·페이지네이션한다 — 넉넉히 가져온다. */
const FETCH_SIZE = 1000;

type ItemType = 'plan' | 'optional-feature' | 'capacity-addon';
type ItemTypeFilter = ItemType | 'ALL';

const ITEM_TYPE_OPTIONS: Array<{ value: ItemTypeFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'plan', label: '과금 플랜' },
  { value: 'optional-feature', label: '선택옵션' },
  { value: 'capacity-addon', label: '용량 추가구매' },
];

/** "새 오버라이드 추가" 선택창에서는 종류를 반드시 하나 골라야 한다 — "전체"는 조회 전용 필터라 제외. */
const NEW_OVERRIDE_ITEM_TYPE_OPTIONS: Array<{ value: ItemType; label: string }> = [
  { value: 'plan', label: '과금 플랜' },
  { value: 'optional-feature', label: '선택옵션' },
  { value: 'capacity-addon', label: '용량 추가구매' },
];

const API_SEGMENT: Record<ItemType, string> = {
  plan: 'plans',
  'optional-feature': 'optional-features',
  'capacity-addon': 'capacity-addons',
};

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const today = () => new Date().toISOString().slice(0, 10);

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

const addOnLabel = (addOn: CapacityAddOnSummary) => {
  const primary = `${CAPACITY_TYPE_LABEL[addOn.capacityType]} +${addOn.unitAmount}`;
  if (!addOn.secondaryCapacityType) return primary;
  return `${primary} · ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType]} +${addOn.secondaryUnitAmount}`;
};

/** 세 종류(플랜/선택옵션/용량추가구매) 응답을 한 테이블로 그리기 위한 공통 행 모양. */
interface OverrideRow {
  id: number;
  itemType: ItemType;
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
  itemType: 'plan',
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
  itemType: 'optional-feature',
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
  itemType: 'capacity-addon',
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

interface SearchParams {
  itemType: ItemTypeFilter;
  organizationId: number | '';
}

const EMPTY_SEARCH: SearchParams = { itemType: 'ALL', organizationId: '' };

const fetchPlanRows = async (query: URLSearchParams): Promise<OverrideRow[]> => {
  const response = await api.get(`/platform-admin/billing-discounts/plans?${query.toString()}`);
  return (response.data as PageResponse<OrganizationBillingPlanDiscountSummary>).content.map(toPlanRow);
};

const fetchFeatureRows = async (query: URLSearchParams): Promise<OverrideRow[]> => {
  const response = await api.get(`/platform-admin/billing-discounts/optional-features?${query.toString()}`);
  return (response.data as PageResponse<OrganizationOptionalFeatureDiscountSummary>).content.map(toFeatureRow);
};

const fetchAddOnRows = async (query: URLSearchParams): Promise<OverrideRow[]> => {
  const response = await api.get(`/platform-admin/billing-discounts/capacity-addons?${query.toString()}`);
  return (response.data as PageResponse<OrganizationCapacityAddOnDiscountSummary>).content.map(toAddOnRow);
};

/**
 * 검색 조건에 맞는 전체 행을 가져온다("전체" 선택 시 세 엔드포인트를 병합) — 페이지네이션은
 * 이 결과를 받은 쪽이 클라이언트에서 한다(위 FETCH_SIZE 참고).
 */
const fetchAllRows = async (search: SearchParams): Promise<OverrideRow[]> => {
  const query = new URLSearchParams();
  if (search.organizationId !== '') query.set('organizationId', String(search.organizationId));
  query.set('page', '0');
  query.set('size', String(FETCH_SIZE));

  if (search.itemType === 'plan') return fetchPlanRows(query);
  if (search.itemType === 'optional-feature') return fetchFeatureRows(query);
  if (search.itemType === 'capacity-addon') return fetchAddOnRows(query);

  const [plans, features, addOns] = await Promise.all([fetchPlanRows(query), fetchFeatureRows(query), fetchAddOnRows(query)]);
  return [...plans, ...features, ...addOns];
};

/**
 * 파트너별 할인 오버라이드 조직 횡단 목록 — 조직 상세 화면에 묻혀 있던 `OrganizationDiscountPanel`을
 * 분리했다(signstage-docs business/discount-management-screen-separation-review.md 결정
 * #5(2026-09-08)). 모든 행이 이미 실제 오버라이드라 별도 "있는 것만" 필터는 두지 않는다(6장
 * 결정 #1). 상세(기간 추가/수정/삭제)는 각 행의 "상세" 링크로 별도 화면
 * (`AdminOrganizationDiscountOverrideDetail`)에서 한다.
 *
 * 검색 영역은 `signstage-docs frontend/list-screen-convention.md`의 "검색 영역 → 목록 →
 * 페이지네비게이션" 3단 구조를 따른다 — 품목 종류(전체/플랜/선택옵션/용량추가구매)/조직 둘 다
 * 검색 조건이다. "전체"는 세 엔드포인트가 서로 다른 테이블이라 한 쿼리로 페이지네이션할 수
 * 없어, 조건이 바뀔 때마다 세 종류를 한꺼번에 크게(FETCH_SIZE) 가져온 뒤 클라이언트에서
 * 병합·페이지네이션한다 — 관리자 화면 수준의 데이터량을 전제한 단순화다.
 *
 * "새 오버라이드 추가" 버튼은 아직 오버라이드가 하나도 없는 조직×품목 조합도 시작할 수 있게
 * 한다 — 목록에는 이미 기간이 있는 조합만 나오므로(오버라이드가 없는 품목은 행 자체가 없다).
 * 조직/품목 종류/품목과 함께 할인값·기간까지 이 화면(선택창)에서 한 번에 입력해 바로
 * 생성하고(기존 기간 생성 API를 그대로 씀), 성공하면 그 조합의 상세 화면으로 이동한다 —
 * 상세 화면을 한 번 더 거쳐 "기간 추가"를 다시 누를 필요가 없다.
 */
export const AdminOrganizationDiscountOverrides: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [allRows, setAllRows] = useState<OverrideRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);

  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [newOverrideOrganizationId, setNewOverrideOrganizationId] = useState<number | ''>('');
  const [newOverrideItemType, setNewOverrideItemType] = useState<ItemType>('plan');
  const [newOverrideItemId, setNewOverrideItemId] = useState<number | ''>('');
  const [newOverrideDiscountType, setNewOverrideDiscountType] = useState<DiscountType>('PERCENT');
  const [newOverrideDiscountValue, setNewOverrideDiscountValue] = useState(0);
  const [newOverrideEffectiveFrom, setNewOverrideEffectiveFrom] = useState(today());
  const [newOverrideEffectiveTo, setNewOverrideEffectiveTo] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ORGANIZATION_DISCOUNT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/platform-admin/organizations?size=200');
        const data = (response.data as PageResponse<PlatformAdminOrganizationSummary>).content;
        if (!cancelled) setOrganizations(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '조직 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await fetchAllRows(searchParams);
        if (!cancelled) setAllRows(data);
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
  }, [searchParams]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const openAddPicker = async () => {
    setIsAddPickerOpen(true);
    setNewOverrideOrganizationId('');
    setNewOverrideItemType('plan');
    setNewOverrideItemId('');
    setNewOverrideDiscountType('PERCENT');
    setNewOverrideDiscountValue(0);
    setNewOverrideEffectiveFrom(today());
    setNewOverrideEffectiveTo('');
    try {
      const [plansResponse, featuresResponse, addOnsResponse] = await Promise.all([
        api.get('/billing-plans'),
        api.get('/optional-features'),
        api.get('/capacity-addons'),
      ]);
      setPlans(plansResponse.data as BillingPlanSummary[]);
      setFeatures(featuresResponse.data as OptionalFeatureSummary[]);
      setAddOns(addOnsResponse.data as CapacityAddOnSummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '품목 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const handleCreateNewOverride = async () => {
    if (!newOverrideOrganizationId || !newOverrideItemId) {
      showSnackbar('조직과 품목을 모두 선택해주세요.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      await api.post(
        `/platform-admin/organizations/${newOverrideOrganizationId}/billing-discounts/${API_SEGMENT[newOverrideItemType]}/${newOverrideItemId}`,
        {
          discountType: newOverrideDiscountType,
          discountValue: newOverrideDiscountValue,
          effectiveFrom: newOverrideEffectiveFrom,
          effectiveTo: newOverrideEffectiveTo === '' ? null : newOverrideEffectiveTo,
        },
      );
      showSnackbar('오버라이드 기간을 생성했습니다.', 'success');
      setIsAddPickerOpen(false);
      navigate(`/admin/organization-discount-overrides/${newOverrideOrganizationId}/${newOverrideItemType}/${newOverrideItemId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '생성에 실패했습니다.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const newOverrideItemOptions =
    newOverrideItemType === 'plan'
      ? plans.map((plan) => ({ id: plan.id, label: plan.name }))
      : newOverrideItemType === 'optional-feature'
        ? features.map((feature) => ({ id: feature.id, label: feature.name }))
        : addOns.map((addOn) => ({ id: addOn.id, label: addOnLabel(addOn) }));

  const totalElements = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const rows = allRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
            <Tag size={18} />
            파트너별 할인 오버라이드
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            특정 조직이 특정 플랜/선택옵션/용량 추가구매를 살 때 카탈로그 할인 대신 적용할 값입니다. 품목당 기간을
            여러 개 둘 수 있고, 겹치지 않는 한 기간별로 다른 할인값을 예약해둘 수 있습니다.
          </p>
        </div>
        {canManage && (
          <Button className="shrink-0" onClick={openAddPicker}>
            <Plus size={16} />
            새 오버라이드 추가
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="품목 종류" className="w-40">
          <select
            value={formValues.itemType}
            onChange={(e) => setFormValues((prev) => ({ ...prev, itemType: e.target.value as ItemTypeFilter }))}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            {ITEM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SearchField>
        <SearchField label="조직" className="w-56">
          <select
            value={formValues.organizationId}
            onChange={(e) => setFormValues((prev) => ({ ...prev, organizationId: e.target.value ? Number(e.target.value) : '' }))}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
          >
            <option value="">전체</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyMessage="설정된 오버라이드가 없습니다."
        pagination={{
          page,
          totalPages,
          hasNext: (page + 1) * PAGE_SIZE < totalElements,
          totalElements,
          onPageChange: setPage,
        }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">조직</th>
              <th className="text-left px-4 py-3 font-medium">품목 종류</th>
              <th className="text-left px-4 py-3 font-medium">품목</th>
              <th className="text-left px-4 py-3 font-medium">할인</th>
              <th className="text-left px-4 py-3 font-medium">기간</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">상세</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={`${row.itemType}-${row.id}`}>
                <td className="px-4 py-3">
                  <Link
                    to={`/admin/organizations/${row.organizationId}`}
                    className="inline-flex items-center gap-1.5 text-gray-950 hover:underline"
                  >
                    <Building2 size={14} className="text-gray-400" />
                    {row.organizationName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {ITEM_TYPE_OPTIONS.find((option) => option.value === row.itemType)?.label}
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
                    to={`/admin/organization-discount-overrides/${row.organizationId}/${row.itemType}/${row.itemId}`}
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

      <Modal open={isAddPickerOpen} onClose={() => setIsAddPickerOpen(false)} title="새 오버라이드 추가" widthClassName="max-w-md">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">조직·품목·기간을 한 번에 정해 새 오버라이드 기간을 만듭니다.</p>
          <Field label="조직">
            <select
              value={newOverrideOrganizationId}
              onChange={(e) => setNewOverrideOrganizationId(e.target.value ? Number(e.target.value) : '')}
              disabled={isCreating}
              className={pickerInputClass}
            >
              <option value="">선택</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="품목 종류">
            <select
              value={newOverrideItemType}
              onChange={(e) => {
                setNewOverrideItemType(e.target.value as ItemType);
                setNewOverrideItemId('');
              }}
              disabled={isCreating}
              className={pickerInputClass}
            >
              {NEW_OVERRIDE_ITEM_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="품목">
            <select
              value={newOverrideItemId}
              onChange={(e) => setNewOverrideItemId(e.target.value ? Number(e.target.value) : '')}
              disabled={isCreating}
              className={pickerInputClass}
            >
              <option value="">선택</option>
              {newOverrideItemOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="할인 방식">
              <select
                value={newOverrideDiscountType}
                onChange={(e) => setNewOverrideDiscountType(e.target.value as DiscountType)}
                disabled={isCreating}
                className={pickerInputClass}
              >
                {DISCOUNT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="할인 값">
              <input
                type="number"
                min={0}
                value={newOverrideDiscountValue === 0 ? '' : newOverrideDiscountValue}
                onChange={(e) => setNewOverrideDiscountValue(Number(e.target.value))}
                disabled={isCreating}
                className={pickerInputClass}
              />
            </Field>
            <Field label="시작일">
              <input
                type="date"
                value={newOverrideEffectiveFrom}
                onChange={(e) => setNewOverrideEffectiveFrom(e.target.value)}
                disabled={isCreating}
                className={pickerInputClass}
              />
            </Field>
            <Field label="종료일(선택, 비우면 무기한)">
              <input
                type="date"
                value={newOverrideEffectiveTo}
                onChange={(e) => setNewOverrideEffectiveTo(e.target.value)}
                disabled={isCreating}
                className={pickerInputClass}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-1.5 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddPickerOpen(false)} disabled={isCreating}>
              취소
            </Button>
            <Button type="button" size="sm" onClick={handleCreateNewOverride} disabled={isCreating}>
              {isCreating && <Loader2 size={11} className="animate-spin" />}
              생성
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const pickerInputClass =
  'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white';

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
