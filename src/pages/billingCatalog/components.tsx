import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { History, Loader2, Pencil, Plus, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { api } from '../../utils/api';
import { formatDateTime } from '../../utils/internationalization';
import {
  DISCOUNT_TYPE_OPTIONS,
  EFFECT_TRIGGER_LABEL,
  EMPTY_PERIOD_DRAFT,
  PERIOD_STATUS_LABEL,
  PERIOD_STATUS_STYLE,
  formatDiscount,
  formatPrice,
  inputClass,
} from './constants';
import type {
  CatalogPricePeriodHistorySummary,
  CatalogPricePeriodRequest,
  CatalogPricePeriodSummary,
  CeremonyEffectDefinition,
  DiscountType,
} from '../../types';

/**
 * 과금 카탈로그(플랜/선택옵션/용량 추가구매) 3개 타입의 목록/등록/상세/수정 화면이 공유하는
 * 컴포넌트 — 순수 상수/포맷터는 `constants.ts`에 분리했다(react-refresh/only-export-components
 * 린트 규칙 때문에 컴포넌트와 비컴포넌트 export를 한 파일에 안 섞는다).
 */

export const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

/** 상세 화면이 공유하는 읽기 전용 행 — AdminOrganizationDetail.tsx의 DetailRow와 같은 모양. */
export const DetailRow: FC<{ icon?: ReactNode; label: string; value: ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 px-4 py-3">
    <span className="w-32 shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {icon}
      {label}
    </span>
    <span className="text-sm text-gray-950">{value}</span>
  </div>
);

export const FormActions: FC<{
  isSaving: boolean;
  savingLabel: string;
  saveLabel: string;
  onSave?: () => void;
  onCancel: () => void;
}> = ({ isSaving, savingLabel, saveLabel, onSave, onCancel }) => (
  <div className="flex gap-2">
    <Button type={onSave ? 'button' : 'submit'} size="sm" onClick={onSave} disabled={isSaving}>
      {isSaving ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          {savingLabel}
        </>
      ) : (
        saveLabel
      )}
    </Button>
    <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
      <X size={12} />
      취소
    </Button>
  </div>
);

/**
 * "이벤트 효과 묶음"(EVENT_EFFECT_BUNDLE) 상품이 열어줄 효과를 고르는 체크박스 목록 —
 * signstage-docs business/ceremony-event-effect-implementation-tasks.md, 2026-09-08 결정.
 */
export const EffectDefinitionPicker: FC<{
  definitions: CeremonyEffectDefinition[];
  selectedIds: number[];
  disabled: boolean;
  onChange: (ids: number[]) => void;
}> = ({ definitions, selectedIds, disabled, onChange }) => {
  const toggle = (id: number, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((existing) => existing !== id));
  };

  return (
    <div className="sm:col-span-2 md:col-span-3">
      <span className="block text-xs font-medium text-gray-500 mb-1">이 묶음이 여는 이벤트 효과</span>
      {definitions.length === 0 ? (
        <p className="text-xs text-gray-400">등록된 이벤트 효과가 없습니다. 먼저 이벤트 효과 관리 화면에서 효과를 등록해주세요.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 rounded-md border border-gray-200 bg-white p-3 max-h-48 overflow-y-auto">
          {definitions.map((definition) => (
            <label key={definition.id} className="flex items-center gap-1.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={selectedIds.includes(definition.id)}
                disabled={disabled}
                onChange={(e) => toggle(definition.id, e.target.checked)}
              />
              <span className="truncate" title={definition.displayName}>
                {definition.displayName}
                <span className="text-gray-400"> · {EFFECT_TRIGGER_LABEL[definition.triggerType] ?? definition.triggerType}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

/** 목록/상세 화면이 공유하는 사용여부 배지. */
export const ActiveBadge: FC<{ active: boolean }> = ({ active }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
      active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
    }`}
  >
    {active ? '사용' : '미사용'}
  </span>
);

/**
 * 수정 폼이 공유하는 "사용 중" 경고 — signstage-docs business/ceremony-billing-options-review.md
 * 9장. 값을 바꿔도 이미 확정/구매한 건은 스냅샷 고정이라 영향받지 않지만, 관리자가 몇 건에
 * 영향을 주는지는 알 수 있게 보여준다.
 */
export const UsageWarning: FC<{ count: number; itemLabel: string }> = ({ count, itemLabel }) =>
  count === 0 ? null : (
    <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
      이 {itemLabel}을(를) 이미 확정/구매해서 쓰고 있는 건이 {count}건 있습니다. 값을 바꿔도 그 건들은 확정/구매 시점 기준으로
      고정돼 있어 영향받지 않습니다.
    </p>
  );

/** 등록/판매가격 기간 폼이 공유하는 사용여부 편집 필드. */
export const ActiveField: FC<{ active: boolean; disabled: boolean; onChange: (active: boolean) => void }> = ({
  active,
  disabled,
  onChange,
}) => (
  <Field label="사용여부">
    <label className="flex items-center gap-1.5 text-sm text-gray-700 h-[34px]">
      <input type="checkbox" checked={active} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {active ? '사용' : '미사용(신규 선택/구매 대상에서 제외)'}
    </label>
  </Field>
);

/** 목록의 "상태" 열이 쓰는 배지 — 오늘 기준 유효한 판매가격 기간의 상태를 보여준다. */
export const PeriodStatusBadge: FC<{ status: string }> = ({ status }) => (
  <span
    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
      PERIOD_STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-500 border-gray-200'
    }`}
  >
    {PERIOD_STATUS_LABEL[status] ?? status}
  </span>
);

/**
 * 세 카탈로그 타입(플랜/선택옵션/용량 추가구매)이 공유하는 판매가격 기간 관리 — 상세 화면의
 * 기본 정보 목록 바로 아래 인라인 목록으로 보여준다(사용자 요청, 2026-09-09 — 원래는 모달이었다).
 * `basePath`가 `/platform-admin/billing-plans` 등 각 타입의 관리자 API prefix를 결정한다.
 * 변경 이력은 여전히 별도(작은) 모달로 연다 — signstage-docs
 * business/billing-catalog-price-validity-period-review.md 결정(2026-09-09, 다중버전 채택).
 */
export const PricePeriodSection: FC<{
  itemId: number;
  basePath: string;
  /** PLATFORM_OPS 이상만 추가/수정/삭제 버튼을 본다 — 목록·이력 조회는 누구나 볼 수 있다. */
  canManage: boolean;
  onChanged: () => void;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}> = ({ itemId, basePath, canManage, onChanged, showSnackbar }) => {
  const [periods, setPeriods] = useState<CatalogPricePeriodSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<CatalogPricePeriodRequest>(EMPTY_PERIOD_DRAFT());
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<CatalogPricePeriodRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<CatalogPricePeriodHistorySummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const fetchPeriods = async (id: number) => (await api.get(`${basePath}/${id}/periods`)).data as CatalogPricePeriodSummary[];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchPeriods(itemId);
        if (!cancelled) setPeriods(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '판매가격 기간을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const openHistory = async () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const response = await api.get(`${basePath}/${itemId}/periods/history`);
      setHistory(response.data as CatalogPricePeriodHistorySummary[]);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '기간 변경 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const reloadPeriods = async () => {
    setPeriods(await fetchPeriods(itemId));
    onChanged();
  };

  const handleAdd = async () => {
    setIsSaving(true);
    try {
      await api.post(`${basePath}/${itemId}/periods`, addDraft);
      showSnackbar('판매가격 기간을 추가했습니다.', 'success');
      setIsAdding(false);
      setAddDraft(EMPTY_PERIOD_DRAFT());
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 추가에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditPeriod = (period: CatalogPricePeriodSummary) => {
    setEditingPeriodId(period.id);
    setEditDraft({
      currencyCode: period.currencyCode,
      supplyPrice: period.supplyPrice,
      salePrice: period.salePrice,
      discountType: period.discountType,
      discountValue: period.discountValue,
      taxCode: period.taxCode,
      active: period.active,
      effectiveFrom: period.effectiveFrom,
      effectiveTo: period.effectiveTo,
    });
  };

  const handleSaveEditPeriod = async (periodId: number) => {
    if (!editDraft) return;
    setIsSaving(true);
    try {
      await api.put(`${basePath}/${itemId}/periods/${periodId}`, editDraft);
      showSnackbar('판매가격 기간을 저장했습니다.', 'success');
      setEditingPeriodId(null);
      setEditDraft(null);
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePeriod = async (periodId: number) => {
    setIsSaving(true);
    try {
      await api.delete(`${basePath}/${itemId}/periods/${periodId}`);
      showSnackbar('판매가격 기간을 삭제했습니다.', 'success');
      await reloadPeriods();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '판매가격 기간 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPeriodForm = (
    draft: CatalogPricePeriodRequest,
    setDraft: (updater: (prev: CatalogPricePeriodRequest) => CatalogPricePeriodRequest) => void,
    disabled: boolean,
  ) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Field label="통화">
        <select
          value={draft.currencyCode}
          onChange={(e) => setDraft((prev) => ({ ...prev, currencyCode: e.target.value }))}
          disabled={disabled}
          className={inputClass}
        >
          {['KRW', 'USD', 'EUR', 'JPY'].map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </Field>
      <Field label="공급가">
        <input
          type="number"
          min={0}
          value={draft.supplyPrice === null ? '' : draft.supplyPrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, supplyPrice: e.target.value === '' ? null : Number(e.target.value) }))}
          placeholder="미상"
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="판매가">
        <input
          type="number"
          min={0}
          value={draft.salePrice === 0 ? '' : draft.salePrice}
          onChange={(e) => setDraft((prev) => ({ ...prev, salePrice: Number(e.target.value) }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="할인 방식">
        <select
          value={draft.discountType}
          onChange={(e) => setDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
          disabled={disabled}
          className={inputClass}
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
          value={draft.discountValue === 0 ? '' : draft.discountValue}
          onChange={(e) => setDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="시작일">
        <input
          type="date"
          value={draft.effectiveFrom}
          onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <Field label="종료일(무기한이면 비움)">
        <input
          type="date"
          value={draft.effectiveTo ?? ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value === '' ? null : e.target.value }))}
          disabled={disabled}
          className={inputClass}
        />
      </Field>
      <ActiveField active={draft.active} disabled={disabled} onChange={(active) => setDraft((prev) => ({ ...prev, active }))} />
    </div>
  );

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950">판매가격 기간</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={openHistory}>
            <History size={12} />
            변경 이력
          </Button>
          {canManage && !isAdding && (
            <Button
              size="sm"
              onClick={() => {
                setIsAdding(true);
                setAddDraft(EMPTY_PERIOD_DRAFT());
              }}
            >
              <Plus size={12} />
              새 기간 추가
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {isAdding && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
              {renderPeriodForm(addDraft, setAddDraft, isSaving)}
              <FormActions
                isSaving={isSaving}
                savingLabel="추가 중..."
                saveLabel="추가"
                onSave={handleAdd}
                onCancel={() => {
                  setIsAdding(false);
                  setAddDraft(EMPTY_PERIOD_DRAFT());
                }}
              />
            </div>
          )}

          {periods.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 판매가격 기간이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {periods.map((period) =>
                editingPeriodId === period.id && editDraft ? (
                  <li key={period.id} className="py-3 bg-gray-50 -mx-1 px-1 rounded-md space-y-3">
                    {renderPeriodForm(editDraft, (updater) => setEditDraft((prev) => prev && updater(prev)), isSaving)}
                    <FormActions
                      isSaving={isSaving}
                      savingLabel="저장 중..."
                      saveLabel="저장"
                      onSave={() => handleSaveEditPeriod(period.id)}
                      onCancel={() => {
                        setEditingPeriodId(null);
                        setEditDraft(null);
                      }}
                    />
                  </li>
                ) : (
                  <li key={period.id} className="py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-950 font-medium">{formatPrice(period.salePrice, period.currencyCode)}</span>
                        <span className="text-xs text-gray-500">할인 {formatDiscount(period.discountType, period.discountValue)}</span>
                        <PeriodStatusBadge status={period.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {period.effectiveFrom} ~ {period.effectiveTo ?? '무기한'}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => startEditPeriod(period)}
                          disabled={editingPeriodId !== null || isAdding}
                        >
                          <Pencil size={12} />
                          수정
                        </Button>
                        <Button
                          variant="danger-outline"
                          size="sm"
                          onClick={() => handleRemovePeriod(period.id)}
                          disabled={isSaving || periods.length <= 1}
                          title={periods.length <= 1 ? '마지막 남은 기간은 삭제할 수 없습니다.' : undefined}
                        >
                          <X size={12} />
                          삭제
                        </Button>
                      </div>
                    )}
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}

      <HistoryModal
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="판매가격 기간 변경 이력"
        isLoading={isHistoryLoading}
        isEmpty={history.length === 0}
      >
        {history.map((h) => (
          <li key={h.id} className="py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-950 font-medium">{formatPrice(h.salePrice, h.currencyCode)}</p>
              <ActiveBadge active={h.active} />
              {h.removed && <span className="text-xs text-red-600 font-medium">제거됨</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {h.effectiveFrom} ~ {h.effectiveTo ?? '무기한'} · 할인 {formatDiscount(h.discountType, h.discountValue)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(h.createdAt)}</p>
          </li>
        ))}
      </HistoryModal>
    </div>
  );
};

/** 이력 모달(생성 시점/이후 변경분 목록) 공통 셸 — 타입별로 항목 렌더링만 다르다. */
export const HistoryModal: FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  isLoading: boolean;
  isEmpty: boolean;
  children: ReactNode;
}> = ({ open, onClose, title, isLoading, isEmpty, children }) => (
  <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-lg">
    {isLoading ? (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    ) : isEmpty ? (
      <p className="text-sm text-gray-400">변경 이력이 없습니다.</p>
    ) : (
      <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">{children}</ul>
    )}
  </Modal>
);

export const HistoryButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <Button variant="secondary" size="sm" onClick={onClick}>
    <History size={12} />
    이력
  </Button>
);
