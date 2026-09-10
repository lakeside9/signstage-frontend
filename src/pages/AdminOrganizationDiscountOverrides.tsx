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
  DiscountType,
  OrganizationBillingPlanDiscountSummary,
  OrganizationDiscountPeriodStatus,
  PageResponse,
  PlatformAdminOrganizationSummary,
} from '../types';

const PAGE_SIZE = 20;

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const today = () => new Date().toISOString().slice(0, 10);

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

interface SearchParams {
  organizationId: number | '';
}

const EMPTY_SEARCH: SearchParams = { organizationId: '' };

/**
 * 파트너별 할인 오버라이드 조직 횡단 목록 — 조직 상세 화면에 묻혀 있던 `OrganizationDiscountPanel`을
 * 분리했다(signstage-docs business/discount-management-screen-separation-review.md 결정
 * #5(2026-09-08)). 조직×플랜 오버라이드 하나뿐이다 — 옛 선택옵션/용량추가구매 오버라이드는
 * `UnitProduct` 통합으로 폐지됐다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10, 4장) —
 * 단위 상품 자체가 할인을 갖지 않으므로 오버라이드할 대상이 없어졌다. 모든 행이 이미 실제
 * 오버라이드라 별도 "있는 것만" 필터는 두지 않는다(6장 결정 #1). 상세(기간 추가/수정/삭제)는
 * 각 행의 "상세" 링크로 별도 화면(`AdminOrganizationDiscountOverrideDetail`)에서 한다.
 *
 * "새 오버라이드 추가" 버튼은 아직 오버라이드가 하나도 없는 조직×플랜 조합도 시작할 수 있게
 * 한다 — 목록에는 이미 기간이 있는 조합만 나오므로(오버라이드가 없는 플랜은 행 자체가 없다).
 * 조직/플랜과 함께 할인값·기간까지 이 화면(선택창)에서 한 번에 입력해 바로 생성하고(기존
 * 기간 생성 API를 그대로 씀), 성공하면 그 조합의 상세 화면으로 이동한다.
 */
export const AdminOrganizationDiscountOverrides: FC = () => {
  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<OrganizationBillingPlanDiscountSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);

  const [isAddPickerOpen, setIsAddPickerOpen] = useState(false);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [newOverrideOrganizationId, setNewOverrideOrganizationId] = useState<number | ''>('');
  const [newOverridePlanId, setNewOverridePlanId] = useState<number | ''>('');
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

  const fetchRows = async () => {
    const query = new URLSearchParams();
    if (searchParams.organizationId !== '') query.set('organizationId', String(searchParams.organizationId));
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/billing-discounts/plans?${query.toString()}`);
    return response.data as PageResponse<OrganizationBillingPlanDiscountSummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await fetchRows();
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
  }, [searchParams, page]);

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
    setNewOverridePlanId('');
    setNewOverrideDiscountType('PERCENT');
    setNewOverrideDiscountValue(0);
    setNewOverrideEffectiveFrom(today());
    setNewOverrideEffectiveTo('');
    try {
      const plansResponse = await api.get('/billing-plans');
      setPlans(plansResponse.data as BillingPlanSummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '플랜 목록을 불러오지 못했습니다.', 'error');
    }
  };

  const handleCreateNewOverride = async () => {
    if (!newOverrideOrganizationId || !newOverridePlanId) {
      showSnackbar('조직과 플랜을 모두 선택해주세요.', 'error');
      return;
    }
    setIsCreating(true);
    try {
      await api.post(`/platform-admin/organizations/${newOverrideOrganizationId}/billing-discounts/plans/${newOverridePlanId}`, {
        discountType: newOverrideDiscountType,
        discountValue: newOverrideDiscountValue,
        effectiveFrom: newOverrideEffectiveFrom,
        effectiveTo: newOverrideEffectiveTo === '' ? null : newOverrideEffectiveTo,
      });
      showSnackbar('오버라이드 기간을 생성했습니다.', 'success');
      setIsAddPickerOpen(false);
      navigate(`/admin/organization-discount-overrides/${newOverrideOrganizationId}/${newOverridePlanId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '생성에 실패했습니다.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const rows = pageData?.content ?? [];
  const totalElements = pageData?.totalElements ?? 0;
  const totalPages = pageData?.totalPages ?? 1;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
            <Tag size={18} />
            파트너별 할인 오버라이드
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            특정 조직이 특정 플랜을 쓸 때 카탈로그 할인 대신 적용할 값입니다. 플랜당 기간을 여러 개 둘 수 있고,
            겹치지 않는 한 기간별로 다른 할인값을 예약해둘 수 있습니다.
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
        <SearchField label="조직" className="w-56">
          <select
            value={formValues.organizationId}
            onChange={(e) => setFormValues({ organizationId: e.target.value ? Number(e.target.value) : '' })}
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
          hasNext: page < totalPages - 1,
          totalElements,
          onPageChange: setPage,
        }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">조직</th>
              <th className="text-left px-4 py-3 font-medium">플랜</th>
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
                <td className="px-4 py-3 font-medium text-gray-950">{row.billingPlanName}</td>
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
                    to={`/admin/organization-discount-overrides/${row.organizationId}/${row.billingPlanId}`}
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
          <p className="text-xs text-gray-500">조직·플랜·기간을 한 번에 정해 새 오버라이드 기간을 만듭니다.</p>
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
          <Field label="플랜">
            <select
              value={newOverridePlanId}
              onChange={(e) => setNewOverridePlanId(e.target.value ? Number(e.target.value) : '')}
              disabled={isCreating}
              className={pickerInputClass}
            >
              <option value="">선택</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
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
