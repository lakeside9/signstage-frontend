import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { EventDateTimeInput } from '../components/EventDateTimeInput';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { CustomItemsField, ScopeExtrasFields } from './order/components';
import {
  EMPTY_SCOPE_EXTRAS_DRAFT,
  REGION_OPTIONS,
  blankToNull,
  isCustomItemDraftValid,
  isLodgingDraftValid,
  toCustomItemDrafts,
  toCustomItems,
  toScopeExtras,
  toScopeExtrasDraft,
} from './order/constants';
import type { CustomItemDraft, ScopeExtrasDraft } from './order/constants';
import type {
  AdminCustomer,
  AdminSalesOrderDetail,
  BillingPlanSummary,
  PageResponse,
  SaveSalesQuoteRequest,
  ServiceRegion,
  UnitProductSummary,
} from '../types';

interface OptionDraft {
  unitProductId: string;
  quantity: string;
}

interface QuoteDraft {
  customerId: string;
  title: string;
  billingPlanId: string;
  region: ServiceRegion;
  location: string;
  startsAt: string;
  endsAt: string;
  options: OptionDraft[];
  customItems: CustomItemDraft[];
  extras: ScopeExtrasDraft;
  discountAmount: string;
  discountReason: string;
  quoteValidUntil: string;
  memo: string;
}

const EMPTY_DRAFT: QuoteDraft = {
  customerId: '', title: '', billingPlanId: '', region: 'CAPITAL', location: '', startsAt: '', endsAt: '',
  options: [], customItems: [], extras: EMPTY_SCOPE_EXTRAS_DRAFT, discountAmount: '', discountReason: '', quoteValidUntil: '', memo: '',
};

const toDraft = (order: AdminSalesOrderDetail): QuoteDraft => {
  const discountLine = order.lines.find((line) => line.lineType === 'DISCOUNT');
  return {
    customerId: String(order.customerId),
    title: order.title,
    billingPlanId: String(order.billingPlanId),
    region: order.region,
    location: order.location ?? '',
    startsAt: order.startsAt?.slice(0, 16) ?? '',
    endsAt: order.endsAt?.slice(0, 16) ?? '',
    options: order.lines
      .filter((line) => line.lineType === 'UNIT_PRODUCT' && line.unitProductId !== null)
      .map((line) => ({ unitProductId: String(line.unitProductId), quantity: String(line.quantity) })),
    customItems: toCustomItemDrafts(order.lines),
    extras: toScopeExtrasDraft(order),
    discountAmount: discountLine ? String(Math.abs(discountLine.amount)) : '',
    discountReason: order.discountReason ?? '',
    quoteValidUntil: order.quoteValidUntil,
    memo: order.memo ?? '',
  };
};

/**
 * 견적 작성·수정(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md
 * 6장·D06·D07. 범위 플랜(패키지)과 추가 옵션을 고르면 서버가 고객 가격표·권역 할증으로 견적을
 * 계산한다. 영업 할인은 공급가에서 뺀다. 수정은 고객이 수락하기 전(견적 상태)에만 할 수 있다.
 */
export const AdminSalesOrderForm: FC = () => {
  const { salesOrderId } = useParams<{ salesOrderId: string }>();
  const isEdit = salesOrderId !== undefined;
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [draft, setDraft] = useState<QuoteDraft>(EMPTY_DRAFT);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [unitProducts, setUnitProducts] = useState<UnitProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customerRes, planRes, productRes, orderRes] = await Promise.all([
          api.get('/platform-admin/customers?status=ACTIVE&size=200'),
          api.get('/billing-plans?salesChannel=PLATFORM_ORDER'),
          api.get('/unit-products?salesChannel=PLATFORM_ORDER'),
          isEdit ? api.get(`/platform-admin/sales-orders/${salesOrderId}`) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCustomers((customerRes.data as PageResponse<AdminCustomer>).content);
        setPlans((planRes.data as BillingPlanSummary[]).filter((plan) => !plan.subscription && plan.active !== false));
        setUnitProducts(productRes.data as UnitProductSummary[]);
        if (orderRes) setDraft(toDraft(orderRes.data as AdminSalesOrderDetail));
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '견적 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, salesOrderId, showSnackbar]);

  const update = <K extends keyof QuoteDraft>(field: K, value: QuoteDraft[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    update('options', draft.options.map((option, i) => (i === index ? { ...option, ...patch } : option)));

  const toQuoteRequest = (): SaveSalesQuoteRequest => ({
    title: draft.title.trim(),
    billingPlanId: Number(draft.billingPlanId),
    region: draft.region,
    location: blankToNull(draft.location),
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
    options: draft.options
      .filter((option) => option.unitProductId && Number(option.quantity) > 0)
      .map((option) => ({ unitProductId: Number(option.unitProductId), quantity: Number(option.quantity) })),
    customItems: toCustomItems(draft.customItems),
    discountAmount: draft.discountAmount === '' ? null : Number(draft.discountAmount),
    discountReason: blankToNull(draft.discountReason),
    ...toScopeExtras(draft.extras),
    quoteValidUntil: draft.quoteValidUntil || null,
    memo: blankToNull(draft.memo),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.customerId || !draft.title.trim() || !draft.billingPlanId) {
      showSnackbar('고객, 행사명, 패키지를 입력해주세요.', 'error');
      return;
    }
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) {
      showSnackbar('종료 일시는 시작 일시보다 늦어야 합니다.', 'error');
      return;
    }
    if (!isLodgingDraftValid(draft.extras)) {
      showSnackbar('숙박은 박수와 인원을 함께 입력해주세요.', 'error');
      return;
    }
    if (!isCustomItemDraftValid(draft.customItems)) {
      showSnackbar('직접 입력 항목은 수량과 고객 단가를 입력해주세요.', 'error');
      return;
    }
    if (Number(draft.discountAmount) > 0 && !draft.discountReason.trim()) {
      showSnackbar('영업 할인 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (isEdit) {
        await api.put(`/platform-admin/sales-orders/${salesOrderId}/quote`, toQuoteRequest());
        showSnackbar('견적을 수정했습니다.', 'success');
        navigate(`/admin/sales-orders/${salesOrderId}`);
      } else {
        const response = await api.post('/platform-admin/sales-orders', {
          customerId: Number(draft.customerId),
          quote: toQuoteRequest(),
        });
        showSnackbar('견적을 만들었습니다.', 'success');
        navigate(`/admin/sales-orders/${(response.data as AdminSalesOrderDetail).id}`);
      }
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '견적 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const selectedPlan = plans.find((plan) => String(plan.id) === draft.billingPlanId);
  const backPath = isEdit ? `/admin/sales-orders/${salesOrderId}` : '/admin/sales-orders';

  return (
    <div className="max-w-3xl">
      <Link to={backPath} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-950">
        <ArrowLeft size={14} /> 돌아가기
      </Link>
      <h1 className="mb-6 text-xl font-bold text-gray-950 flex items-center gap-2">
        <FileText size={20} className="text-gray-400" />
        {isEdit ? '견적 수정' : '견적 작성'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-950">고객·행사</h2>
          <Field label="고객">
            <select
              value={draft.customerId}
              onChange={(e) => update('customerId', e.target.value)}
              disabled={isSaving || isEdit}
              className={`${inputClass} bg-white`}
            >
              <option value="">선택</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </Field>
          <Field label="행사명">
            <input
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="권역">
              <select
                value={draft.region}
                onChange={(e) => update('region', e.target.value as ServiceRegion)}
                disabled={isSaving}
                className={`${inputClass} bg-white`}
              >
                {REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="장소">
              <input
                value={draft.location}
                onChange={(e) => update('location', e.target.value)}
                disabled={isSaving}
                placeholder="선택 입력"
                className={inputClass}
              />
            </Field>
            <Field label="시작 일시">
              <EventDateTimeInput value={draft.startsAt} onChange={(value) => update('startsAt', value)} disabled={isSaving} />
            </Field>
            <Field label="종료 일시">
              <EventDateTimeInput value={draft.endsAt} onChange={(value) => update('endsAt', value)} disabled={isSaving} />
            </Field>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-950">범위</h2>
          <Field label="패키지(범위 플랜)">
            <select
              value={draft.billingPlanId}
              onChange={(e) => update('billingPlanId', e.target.value)}
              disabled={isSaving}
              className={`${inputClass} bg-white`}
            >
              <option value="">선택</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name}</option>
              ))}
            </select>
          </Field>
          {selectedPlan && (
            <p className="text-xs text-gray-500">
              포함: {selectedPlan.unitProducts.map((line) => `${line.unitProductName} ${line.includedQuantity}`).join(', ') || '없음'}
            </p>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">추가 옵션</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => update('options', [...draft.options, { unitProductId: '', quantity: '1' }])}
                disabled={isSaving}
              >
                <Plus size={12} /> 옵션 추가
              </Button>
            </div>
            {draft.options.length === 0 ? (
              <p className="text-xs text-gray-400">추가 태블릿·현장 인력·효과 묶음 등을 옵션으로 넣을 수 있습니다.</p>
            ) : (
              <ul className="space-y-2">
                {draft.options.map((option, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <select
                      value={option.unitProductId}
                      onChange={(e) => updateOption(index, { unitProductId: e.target.value })}
                      disabled={isSaving}
                      className={`${inputClass} bg-white flex-1`}
                    >
                      <option value="">선택</option>
                      {unitProducts.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                    <div className="w-24">
                      <FormattedNumberInput
                        value={option.quantity}
                        onChange={(value) => updateOption(index, { quantity: value })}
                        min={1}
                        disabled={isSaving}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => update('options', draft.options.filter((_, i) => i !== index))}
                      disabled={isSaving}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="옵션 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <CustomItemsField value={draft.customItems} onChange={(next) => update('customItems', next)} disabled={isSaving} />
          <div className="border-t border-gray-100 pt-3">
            <span className="mb-2 block text-xs font-medium text-gray-500">추가 범위</span>
            <ScopeExtrasFields value={draft.extras} onChange={(next) => update('extras', next)} disabled={isSaving} />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-950">견적 조건</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="영업 할인(공급가)">
              <FormattedNumberInput
                value={draft.discountAmount}
                onChange={(value) => update('discountAmount', value)}
                min={0}
                disabled={isSaving}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="할인 사유">
              <input
                value={draft.discountReason}
                onChange={(e) => update('discountReason', e.target.value)}
                disabled={isSaving}
                placeholder="할인이 있으면 필수"
                className={inputClass}
              />
            </Field>
            <Field label="견적 유효기간">
              <input
                type="date"
                value={draft.quoteValidUntil}
                onChange={(e) => update('quoteValidUntil', e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
          </div>
          {!draft.quoteValidUntil && <p className="text-xs text-gray-400">비우면 오늘부터 30일입니다.</p>}
          <Field label="내부 메모">
            <textarea
              value={draft.memo}
              onChange={(e) => update('memo', e.target.value)}
              disabled={isSaving}
              rows={3}
              className={inputClass}
            />
          </Field>
        </section>

        <FormActions
          isSaving={isSaving}
          savingLabel="계산 중..."
          saveLabel={isEdit ? '견적 수정' : '견적 만들기'}
          onCancel={() => navigate(backPath)}
        />
      </form>
    </div>
  );
};
