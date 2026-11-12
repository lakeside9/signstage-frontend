import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CalendarX, Loader2, Plus, Receipt } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass, todayIsoDate } from './billingCatalog/constants';
import { REGION_LABEL, REGION_OPTIONS, formatMoney, formatPeriod, isPeriodOpen } from './order/constants';
import type {
  AdminCustomerPrice,
  AdminPartnerRateCard,
  AdminRegionSurcharge,
  BillingPlanSummary,
  PageResponse,
  PlatformAdminOrganizationSummary,
  ServiceRegion,
  UnitProductSummary,
} from '../types';

type PriceTab = 'customerPrices' | 'regionSurcharges' | 'partnerRateCards';

const TABS: Array<{ value: PriceTab; label: string; description: string }> = [
  {
    value: 'customerPrices',
    label: '고객 가격표',
    description: '고객에게 파는 가격입니다. 범위 플랜(패키지)과 추가 옵션(단위 상품)마다 기간별 가격을 둡니다.',
  },
  {
    value: 'regionSurcharges',
    label: '권역 할증',
    description: '행사 권역별 정액 할증입니다. 고객 견적과 파트너 발주에 붙는 금액을 함께 둡니다. 할증이 없는 권역도 0원으로 등록해야 그 권역 견적을 만들 수 있습니다.',
  },
  {
    value: 'partnerRateCards',
    label: '파트너 단가표',
    description: '발주 금액 계산 기준입니다. 파트너 전용 단가표가 있으면 그것을, 없으면 기본 단가표를 씁니다.',
  },
];

const ENDPOINT: Record<PriceTab, string> = {
  customerPrices: '/platform-admin/order-prices/customer-prices',
  regionSurcharges: '/platform-admin/order-prices/region-surcharges',
  partnerRateCards: '/platform-admin/order-prices/partner-rate-cards',
};

interface PriceDraft {
  target: string;
  amount1: string;
  amount2: string;
  amount3: string;
  amount4: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyDraft = (): PriceDraft => ({
  target: '', amount1: '', amount2: '', amount3: '', amount4: '', effectiveFrom: todayIsoDate(), effectiveTo: '',
});

const toNumber = (value: string) => (value === '' ? null : Number(value));

/**
 * 수주 가격표(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md
 * 6장, D05·D06·D26. 고객 가격표·권역 할증·파트너 단가표 세 표를 탭으로 둔다. 가격은 고치지 않고
 * 기간으로 바꾼다 — 새 기간을 등록하고 이전 기간은 종료일을 지정해 닫는다(같은 대상의 기간은 겹칠 수
 * 없다). 견적·발주는 계산 시점의 가격을 스냅샷하므로 닫아도 이미 만든 수주·발주는 바뀌지 않는다.
 */
export const AdminOrderPrices: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ORDER_PRICE_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [activeTab, setActiveTab] = useState<PriceTab>('customerPrices');
  const [customerPrices, setCustomerPrices] = useState<AdminCustomerPrice[]>([]);
  const [regionSurcharges, setRegionSurcharges] = useState<AdminRegionSurcharge[]>([]);
  const [rateCards, setRateCards] = useState<AdminPartnerRateCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [unitProducts, setUnitProducts] = useState<UnitProductSummary[]>([]);
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<PriceDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeDate, setCloseDate] = useState('');

  const reload = async () => {
    const [prices, surcharges, cards] = await Promise.all([
      api.get(ENDPOINT.customerPrices),
      api.get(ENDPOINT.regionSurcharges),
      api.get(ENDPOINT.partnerRateCards),
    ]);
    setCustomerPrices(prices.data as AdminCustomerPrice[]);
    setRegionSurcharges(surcharges.data as AdminRegionSurcharge[]);
    setRateCards(cards.data as AdminPartnerRateCard[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        const [planRes, productRes, organizationRes] = await Promise.all([
          api.get('/billing-plans'),
          api.get('/unit-products'),
          api.get('/platform-admin/organizations?status=ACTIVE&size=200'),
        ]);
        if (cancelled) return;
        setPlans(planRes.data as BillingPlanSummary[]);
        setUnitProducts(productRes.data as UnitProductSummary[]);
        setOrganizations((organizationRes.data as PageResponse<PlatformAdminOrganizationSummary>).content);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '가격표를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setDraft(emptyDraft());
    setIsCreateOpen(true);
  };

  const buildCreateRequest = (): Record<string, unknown> | null => {
    const period = { effectiveFrom: draft.effectiveFrom, effectiveTo: draft.effectiveTo || null };
    if (activeTab === 'customerPrices') {
      if (!draft.target || draft.amount1 === '') return null;
      const [kind, id] = draft.target.split(':');
      return {
        billingPlanId: kind === 'plan' ? Number(id) : null,
        unitProductId: kind === 'unit' ? Number(id) : null,
        unitPrice: toNumber(draft.amount1),
        ...period,
      };
    }
    if (activeTab === 'regionSurcharges') {
      if (!draft.target || draft.amount1 === '' || draft.amount2 === '') return null;
      return {
        region: draft.target as ServiceRegion,
        customerAmount: toNumber(draft.amount1),
        partnerAmount: toNumber(draft.amount2),
        lodgingCustomerAmount: toNumber(draft.amount3),
        lodgingPartnerAmount: toNumber(draft.amount4),
        ...period,
      };
    }
    if (draft.amount1 === '' || draft.amount2 === '' || draft.amount3 === '') return null;
    return {
      organizationId: draft.target ? Number(draft.target) : null,
      baseFee: toNumber(draft.amount1),
      tabletUnitRate: toNumber(draft.amount2),
      onsiteStaffDayRate: toNumber(draft.amount3),
      ...period,
    };
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const request = buildCreateRequest();
    if (!request || !draft.effectiveFrom) {
      showSnackbar('필수 항목을 모두 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.post(ENDPOINT[activeTab], request);
      showSnackbar('가격을 등록했습니다.', 'success');
      setIsCreateOpen(false);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '등록에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openClose = (id: number) => {
    setCloseDate(todayIsoDate());
    setClosingId(id);
  };

  const handleClose = async (e: FormEvent) => {
    e.preventDefault();
    if (closingId === null || !closeDate) return;
    setIsSaving(true);
    try {
      await api.put(`${ENDPOINT[activeTab]}/${closingId}/close`, { effectiveTo: closeDate });
      showSnackbar('기간을 닫았습니다.', 'success');
      setClosingId(null);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '기간 종료에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const closeButton = (id: number, effectiveTo: string | null) =>
    canManage && isPeriodOpen(effectiveTo) ? (
      <button
        type="button"
        onClick={() => openClose(id)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
      >
        <CalendarX size={12} /> 기간 종료
      </button>
    ) : null;

  const amountInput = (field: 'amount1' | 'amount2' | 'amount3' | 'amount4', label: string) => (
    <Field label={label}>
      <FormattedNumberInput
        value={draft[field]}
        onChange={(value) => setDraft((prev) => ({ ...prev, [field]: value }))}
        min={0}
        disabled={isSaving}
        className={inputClass}
      />
    </Field>
  );

  const thClass = 'text-left px-4 py-3 font-medium';
  const tdClass = 'px-4 py-3';
  const activeTabMeta = TABS.find((tab) => tab.value === activeTab)!;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Receipt size={20} className="text-gray-400" />
            수주 가격표
          </h1>
          <p className="mt-1 text-sm text-gray-500">{activeTabMeta.description}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 가격 등록
          </Button>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`min-w-28 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              activeTab === tab.value ? 'bg-gray-950 text-white' : 'text-gray-500 hover:text-gray-950'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            {activeTab === 'customerPrices' && (
              <>
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className={thClass}>구분</th>
                    <th className={thClass}>대상</th>
                    <th className={`${thClass} text-right`}>단가(공급가)</th>
                    <th className={thClass}>적용 기간</th>
                    <th className={`${thClass} text-right`}>처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customerPrices.map((price) => (
                    <tr key={price.id}>
                      <td className={`${tdClass} text-gray-500`}>{price.billingPlanId ? '패키지(플랜)' : '옵션(단위 상품)'}</td>
                      <td className={`${tdClass} text-gray-950 font-medium`}>{price.billingPlanName ?? price.unitProductName}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(price.unitPrice, price.currencyCode)}</td>
                      <td className={`${tdClass} text-gray-500`}>{formatPeriod(price.effectiveFrom, price.effectiveTo)}</td>
                      <td className={`${tdClass} text-right`}>{closeButton(price.id, price.effectiveTo)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {activeTab === 'regionSurcharges' && (
              <>
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className={thClass}>권역</th>
                    <th className={`${thClass} text-right`}>고객 할증</th>
                    <th className={`${thClass} text-right`}>파트너 할증</th>
                    <th className={`${thClass} text-right`}>숙박 1박(고객/파트너)</th>
                    <th className={thClass}>적용 기간</th>
                    <th className={`${thClass} text-right`}>처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {regionSurcharges.map((surcharge) => (
                    <tr key={surcharge.id}>
                      <td className={`${tdClass} text-gray-950 font-medium`}>{REGION_LABEL[surcharge.region]}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(surcharge.customerAmount, surcharge.currencyCode)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(surcharge.partnerAmount, surcharge.currencyCode)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>
                        {formatMoney(surcharge.lodgingCustomerAmount, surcharge.currencyCode)} / {formatMoney(surcharge.lodgingPartnerAmount, surcharge.currencyCode)}
                      </td>
                      <td className={`${tdClass} text-gray-500`}>{formatPeriod(surcharge.effectiveFrom, surcharge.effectiveTo)}</td>
                      <td className={`${tdClass} text-right`}>{closeButton(surcharge.id, surcharge.effectiveTo)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {activeTab === 'partnerRateCards' && (
              <>
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className={thClass}>파트너</th>
                    <th className={`${thClass} text-right`}>기본 수행비</th>
                    <th className={`${thClass} text-right`}>태블릿 대당</th>
                    <th className={`${thClass} text-right`}>현장 인력 인·일</th>
                    <th className={thClass}>적용 기간</th>
                    <th className={`${thClass} text-right`}>처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rateCards.map((card) => (
                    <tr key={card.id}>
                      <td className={`${tdClass} text-gray-950 font-medium`}>{card.organizationName ?? '기본 단가표'}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(card.baseFee, card.currencyCode)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(card.tabletUnitRate, card.currencyCode)}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatMoney(card.onsiteStaffDayRate, card.currencyCode)}</td>
                      <td className={`${tdClass} text-gray-500`}>{formatPeriod(card.effectiveFrom, card.effectiveTo)}</td>
                      <td className={`${tdClass} text-right`}>{closeButton(card.id, card.effectiveTo)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        )}
        {!isLoading &&
          ((activeTab === 'customerPrices' && customerPrices.length === 0) ||
            (activeTab === 'regionSurcharges' && regionSurcharges.length === 0) ||
            (activeTab === 'partnerRateCards' && rateCards.length === 0)) && (
            <p className="py-10 text-center text-sm text-gray-400">등록된 가격이 없습니다.</p>
          )}
      </div>

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={`${activeTabMeta.label} 등록`} widthClassName="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-3">
          {activeTab === 'customerPrices' && (
            <>
              <Field label="대상">
                <select
                  value={draft.target}
                  onChange={(e) => setDraft((prev) => ({ ...prev, target: e.target.value }))}
                  disabled={isSaving}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">선택</option>
                  <optgroup label="패키지(범위 플랜)">
                    {plans.filter((plan) => !plan.subscription).map((plan) => (
                      <option key={plan.id} value={`plan:${plan.id}`}>{plan.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="옵션(단위 상품)">
                    {unitProducts.map((product) => (
                      <option key={product.id} value={`unit:${product.id}`}>{product.name}</option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              {amountInput('amount1', '단가(공급가)')}
            </>
          )}
          {activeTab === 'regionSurcharges' && (
            <>
              <Field label="권역">
                <select
                  value={draft.target}
                  onChange={(e) => setDraft((prev) => ({ ...prev, target: e.target.value }))}
                  disabled={isSaving}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">선택</option>
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                {amountInput('amount1', '고객 할증')}
                {amountInput('amount2', '파트너 할증')}
                {amountInput('amount3', '숙박 1박·1인 고객 금액')}
                {amountInput('amount4', '숙박 1박·1인 파트너 금액')}
              </div>
              <p className="text-xs text-gray-400">숙박은 견적에서 관리자가 박수·인원을 넣을 때만 더합니다. 비우면 0원입니다.</p>
            </>
          )}
          {activeTab === 'partnerRateCards' && (
            <>
              <Field label="파트너">
                <select
                  value={draft.target}
                  onChange={(e) => setDraft((prev) => ({ ...prev, target: e.target.value }))}
                  disabled={isSaving}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">기본 단가표(모든 파트너)</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                {amountInput('amount1', '기본 수행비')}
                {amountInput('amount2', '태블릿 대당')}
                {amountInput('amount3', '현장 인력 인·일')}
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
            <Field label="종료일(비우면 종료일 없음)">
              <input
                type="date"
                value={draft.effectiveTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400">금액은 원화 공급가(부가세 별도)입니다. 같은 대상의 기간은 겹칠 수 없습니다.</p>
          <FormActions isSaving={isSaving} savingLabel="등록 중..." saveLabel="등록" onCancel={() => setIsCreateOpen(false)} />
        </form>
      </Modal>

      <Modal open={closingId !== null} onClose={() => setClosingId(null)} title="기간 종료" widthClassName="max-w-sm">
        <form onSubmit={handleClose} className="space-y-3">
          <Field label="종료일">
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-gray-400">종료일까지 이 가격을 쓰고, 다음 날부터는 새 기간 가격을 씁니다.</p>
          <FormActions isSaving={isSaving} savingLabel="처리 중..." saveLabel="기간 종료" onCancel={() => setClosingId(null)} />
        </form>
      </Modal>
    </div>
  );
};
