import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import type {
  InspectionStatus,
  OrderInspectionSummary,
  PartnerLedger,
  PartnerOffsetSummary,
  PartnerOrderStatus,
  PartnerPayoutStatus,
  DiscountType,
  MarginSimulation,
  QuoteTemplate,
  SalesOrderChangeStatus,
  SalesOrderStatus,
} from '../../types';
import { DetailRow, Field } from '../billingCatalog/components';
import { DISCOUNT_TYPE_OPTIONS, inputClass } from '../billingCatalog/constants';
import type { CustomItemDraft, QuoteAdjustmentDraft, ScopeExtrasDraft } from './constants';
import {
  EMPTY_CUSTOM_ITEM_DRAFT,
  DEDUCTION_TYPE_LABEL,
  DISPUTE_STATUS_LABEL,
  INSPECTION_APPROVAL_TYPE_LABEL,
  OFFSET_STATUS_LABEL,
  INSPECTION_STATUS_LABEL,
  INSPECTION_STATUS_STYLE,
  LEDGER_ENTRY_TYPE_LABEL,
  PARTNER_ORDER_STATUS_LABEL,
  PARTNER_ORDER_STATUS_STYLE,
  SALES_ORDER_CHANGE_STATUS_LABEL,
  SALES_ORDER_CHANGE_STATUS_STYLE,
  SALES_ORDER_STATUS_LABEL,
  PAYOUT_STATUS_LABEL,
  PAYOUT_STATUS_STYLE,
  SALES_ORDER_STATUS_STYLE,
  TRUNCATION_UNIT_OPTIONS,
  formatMoney,
  statusBadgeClass,
} from './constants';

export const SalesOrderStatusBadge: FC<{ status: SalesOrderStatus }> = ({ status }) => (
  <span className={`${statusBadgeClass} ${SALES_ORDER_STATUS_STYLE[status]}`}>{SALES_ORDER_STATUS_LABEL[status]}</span>
);

export const SalesOrderChangeStatusBadge: FC<{ status: SalesOrderChangeStatus }> = ({ status }) => (
  <span className={`${statusBadgeClass} ${SALES_ORDER_CHANGE_STATUS_STYLE[status]}`}>{SALES_ORDER_CHANGE_STATUS_LABEL[status]}</span>
);

export const PartnerOrderStatusBadge: FC<{ status: PartnerOrderStatus }> = ({ status }) => (
  <span className={`${statusBadgeClass} ${PARTNER_ORDER_STATUS_STYLE[status]}`}>{PARTNER_ORDER_STATUS_LABEL[status]}</span>
);

interface PartnerOrderAmountBreakdownProps {
  currencyCode: string;
  baseFee: number;
  tabletCount: number;
  tabletUnitRate: number;
  wifiCount: number;
  wifiUnitRate: number;
  onsiteStaffPersonDays: number;
  onsiteStaffDayRate: number;
  regionSurcharge: number;
  adjustmentAmount: number;
  adjustmentReason?: string | null;
  totalAmount: number;
  spareTabletCount?: number;
  rehearsalStaffPersonDays?: number;
  lodgingPersonNights?: number;
  lodgingNightRate?: number;
  customItemAmount?: number;
  /** 직접 입력 항목 내역 — 주면 합계 한 줄 대신 품목별로 보여준다(발주 단가 0원 품목도 보인다). */
  customItems?: PartnerCustomItem[];
}

/** 파트너 발주에 들어가는 직접 입력 항목 한 줄 — 견적 줄에서 가져온다. */
export interface PartnerCustomItem {
  name: string;
  quantity: number;
  partnerUnitPrice: number | null;
}

/**
 * 발주 금액 = 기본 수행비 + (태블릿 + 예비) × 대당 단가 + 와이파이 × 대당 단가 + (현장 인력 + 리허설 별도일) × 일당 + 지역 할증
 * + 숙박 인·박 × 1박 단가 + 직접 입력 항목(수량 × 발주 단가) ± 조정(D05·D23·D24·D26).
 */
export const PartnerOrderAmountBreakdown: FC<PartnerOrderAmountBreakdownProps> = (amount) => {
  const spare = amount.spareTabletCount ?? 0;
  const rehearsal = amount.rehearsalStaffPersonDays ?? 0;
  const lodging = amount.lodgingPersonNights ?? 0;
  const rows: Array<[string, string]> = [
    ['기본 수행비', formatMoney(amount.baseFee, amount.currencyCode)],
    [
      `태블릿 ${amount.tabletCount}대${spare > 0 ? ` + 예비 ${spare}대` : ''} × ${formatMoney(amount.tabletUnitRate, amount.currencyCode)}`,
      formatMoney((amount.tabletCount + spare) * amount.tabletUnitRate, amount.currencyCode),
    ],
    [
      `현장 인력 ${amount.onsiteStaffPersonDays}인·일${rehearsal > 0 ? ` + 리허설 ${rehearsal}인·일` : ''} × ${formatMoney(amount.onsiteStaffDayRate, amount.currencyCode)}`,
      formatMoney((amount.onsiteStaffPersonDays + rehearsal) * amount.onsiteStaffDayRate, amount.currencyCode),
    ],
    ['지역 할증', formatMoney(amount.regionSurcharge, amount.currencyCode)],
  ];
  if (amount.wifiCount > 0) {
    rows.splice(2, 0, [
      `와이파이 장비 ${amount.wifiCount}대 × ${formatMoney(amount.wifiUnitRate, amount.currencyCode)}`,
      formatMoney(amount.wifiCount * amount.wifiUnitRate, amount.currencyCode),
    ]);
  }
  if (lodging > 0) {
    rows.push([
      `숙박 ${lodging}인·박 × ${formatMoney(amount.lodgingNightRate ?? 0, amount.currencyCode)}`,
      formatMoney(lodging * (amount.lodgingNightRate ?? 0), amount.currencyCode),
    ]);
  }
  if (amount.customItems && amount.customItems.length > 0) {
    amount.customItems.forEach((item) => {
      const unitPrice = item.partnerUnitPrice ?? 0;
      rows.push([
        `직접 입력 · ${item.name} ${item.quantity.toLocaleString()} × ${formatMoney(unitPrice, amount.currencyCode)}`,
        formatMoney(item.quantity * unitPrice, amount.currencyCode),
      ]);
    });
  } else if ((amount.customItemAmount ?? 0) > 0) {
    rows.push(['직접 입력 항목', formatMoney(amount.customItemAmount ?? 0, amount.currencyCode)]);
  }
  if (amount.adjustmentAmount !== 0) {
    rows.push([
      `조정${amount.adjustmentReason ? ` (${amount.adjustmentReason})` : ''}`,
      formatMoney(amount.adjustmentAmount, amount.currencyCode),
    ]);
  }
  return (
    <dl className="text-sm divide-y divide-gray-100">
      {rows.map(([label, value], index) => (
        <div key={index} className="flex justify-between gap-3 py-1.5">
          <dt className="text-gray-500">{label}</dt>
          <dd className="text-gray-950 tabular-nums">{value}</dd>
        </div>
      ))}
      <div className="flex justify-between gap-3 py-1.5 font-bold">
        <dt className="text-gray-950">발주 금액(공급가)</dt>
        <dd className="text-gray-950 tabular-nums">{formatMoney(amount.totalAmount, amount.currencyCode)}</dd>
      </div>
    </dl>
  );
};

/** 기한이 지났지만 아직 승인 간주 처리 전인 대기 건은 "기한 경과"로 보여준다. */
export const InspectionStatusBadge: FC<{ status: InspectionStatus; overdue?: boolean }> = ({ status, overdue }) =>
  overdue ? (
    <span className={`${statusBadgeClass} bg-gray-50 text-gray-500 border-gray-200`}>기한 경과</span>
  ) : (
    <span className={`${statusBadgeClass} ${INSPECTION_STATUS_STYLE[status]}`}>{INSPECTION_STATUS_LABEL[status]}</span>
  );

export const PayoutStatusBadge: FC<{ status: PartnerPayoutStatus }> = ({ status }) => (
  <span className={`${statusBadgeClass} ${PAYOUT_STATUS_STYLE[status]}`}>{PAYOUT_STATUS_LABEL[status]}</span>
);

/** 검수 결과 — 기한·승인 방식·하자·지체·감액·지급 대상 금액(D11·D13). */
export const InspectionResultRows: FC<{ inspection: OrderInspectionSummary }> = ({ inspection }) => {
  const currency = inspection.currencyCode;
  const deductionTypeLabel = inspection.deductionType ? DEDUCTION_TYPE_LABEL[inspection.deductionType] : null;
  // 사유를 유형 이름 그대로 두는 경우가 많아, 같으면 한 번만 보인다.
  const deductionText = [deductionTypeLabel, inspection.deductionReason]
    .filter((text, index, texts): text is string => !!text && texts.indexOf(text) === index)
    .join(' · ');
  return (
    <>
      <DetailRow label="검수 상태" value={<InspectionStatusBadge status={inspection.status} overdue={inspection.overdue} />} />
      <DetailRow label="검수 기한" value={inspection.status === 'PENDING' ? `${inspection.dueDate}까지 (지나면 승인 간주)` : inspection.dueDate} />
      {inspection.approvalType && (
        <DetailRow
          label="승인"
          value={`${inspection.approvedDate ?? ''} · ${INSPECTION_APPROVAL_TYPE_LABEL[inspection.approvalType]}`}
        />
      )}
      {inspection.defectNote && <DetailRow label="하자" value={inspection.defectNote} />}
      {inspection.delayNote && <DetailRow label="지체" value={inspection.delayNote} />}
      {inspection.deductionAmount > 0 && (
        <DetailRow
          label="감액"
          value={`${formatMoney(-inspection.deductionAmount, currency)}${deductionText ? ` · ${deductionText}` : ''}`}
        />
      )}
      {inspection.disputeDeadline && !inspection.disputeStatus && (
        <DetailRow label="이의 제기 기한" value={`${inspection.disputeDeadline}까지`} />
      )}
      {inspection.disputeStatus && (
        <DetailRow
          label={DISPUTE_STATUS_LABEL[inspection.disputeStatus]}
          value={`${inspection.disputeReason ?? ''}${inspection.disputeResolutionNote ? ` → 조정: ${inspection.disputeResolutionNote}` : ''}`}
        />
      )}
      {inspection.performanceRating !== null && <DetailRow label="수행 평점" value={`${inspection.performanceRating}/5`} />}
      {inspection.payableAmount !== null && (
        <DetailRow label="지급 대상(공급가)" value={formatMoney(inspection.payableAmount, currency)} />
      )}
    </>
  );
};

/** 지급 건에 묶인 검수 항목. `linkTo`가 있으면 행사명에 링크를 건다. */
export const PayoutItemsTable: FC<{ items: OrderInspectionSummary[]; linkTo?: (item: OrderInspectionSummary) => string }> = ({
  items,
  linkTo,
}) => (
  <table className="w-full text-sm">
    <thead className="text-xs text-gray-500 border-b border-gray-200">
      <tr>
        <th className="text-left font-medium py-2">행사</th>
        <th className="text-left font-medium py-2">승인일</th>
        <th className="text-right font-medium py-2">발주 금액</th>
        <th className="text-right font-medium py-2">감액</th>
        <th className="text-right font-medium py-2">지급 대상</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {items.map((item) => (
        <tr key={item.id}>
          <td className="py-2">
            {linkTo ? <Link to={linkTo(item)} className="hover:underline">{item.title}</Link> : item.title}
            {item.approvalType === 'DEEMED' && <span className="ml-1 text-xs text-gray-400">(승인 간주)</span>}
          </td>
          <td className="py-2 text-gray-500">{item.approvedDate}</td>
          <td className="py-2 text-right tabular-nums">{formatMoney(item.orderAmount, item.currencyCode)}</td>
          <td className="py-2 text-right tabular-nums text-gray-500">
            {item.deductionAmount > 0 ? formatMoney(-item.deductionAmount, item.currencyCode) : '-'}
          </td>
          <td className="py-2 text-right tabular-nums">{formatMoney(item.payableAmount, item.currencyCode)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/** 매입채무 원장 — 미지급 잔액과 최근 항목(공급가 기준). */
export const PartnerLedgerTable: FC<{ ledger: PartnerLedger }> = ({ ledger }) => (
  <div>
    <p className="text-sm text-gray-500">
      미지급 잔액(공급가) <span className="ml-1 text-base font-bold text-gray-950 tabular-nums">{formatMoney(ledger.balance)}</span>
    </p>
    {ledger.entries.content.length === 0 ? (
      <p className="mt-3 text-sm text-gray-400">원장 항목이 없습니다.</p>
    ) : (
      <table className="mt-3 w-full text-sm">
        <thead className="text-xs text-gray-500 border-b border-gray-200">
          <tr>
            <th className="text-left font-medium py-2">일자</th>
            <th className="text-left font-medium py-2">구분</th>
            <th className="text-left font-medium py-2">내용</th>
            <th className="text-right font-medium py-2">금액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ledger.entries.content.map((entry) => (
            <tr key={entry.id}>
              <td className="py-2 text-gray-500">{entry.occurredOn}</td>
              <td className="py-2">{LEDGER_ENTRY_TYPE_LABEL[entry.entryType]}</td>
              <td className="py-2 text-gray-500">{entry.memo ?? '-'}</td>
              <td className={`py-2 text-right tabular-nums ${entry.amount < 0 ? 'text-gray-500' : ''}`}>
                {formatMoney(entry.amount, entry.currencyCode)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

/** 귀책 상계 목록(D13). {@code onCancel}이 있으면 정산 대기 상계에 취소 버튼을 둔다. */
export const OffsetTable: FC<{
  offsets: PartnerOffsetSummary[];
  showPartner?: boolean;
  onCancel?: (offset: PartnerOffsetSummary) => void;
}> = ({ offsets, showPartner, onCancel }) => (
  <table className="w-full text-sm">
    <thead className="text-xs text-gray-500 border-b border-gray-200">
      <tr>
        <th className="text-left font-medium py-2">발생일</th>
        {showPartner && <th className="text-left font-medium py-2">파트너</th>}
        <th className="text-left font-medium py-2">행사</th>
        <th className="text-left font-medium py-2">사유</th>
        <th className="text-right font-medium py-2">상계</th>
        <th className="text-left font-medium py-2 pl-3">상태</th>
        {onCancel && <th className="py-2" />}
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      {offsets.map((offset) => (
        <tr key={offset.id}>
          <td className="py-2 text-gray-500">{offset.occurredOn}</td>
          {showPartner && <td className="py-2 text-gray-950">{offset.organizationName}</td>}
          <td className="py-2 text-gray-950">{offset.title}</td>
          <td className="py-2 text-gray-500">
            {offset.reason}
            {offset.cancellationReason && <p className="text-xs text-gray-400">취소: {offset.cancellationReason}</p>}
          </td>
          <td className="py-2 text-right tabular-nums">{formatMoney(-offset.amount, offset.currencyCode)}</td>
          <td className="py-2 pl-3 text-gray-500">
            {OFFSET_STATUS_LABEL[offset.status]}
            {offset.carriedOver && <p className="text-xs text-gray-400">이월</p>}
          </td>
          {onCancel && (
            <td className="py-2 text-right">
              {offset.status === 'PENDING' && !offset.carriedOver && (
                <button type="button" onClick={() => onCancel(offset)} className="text-xs text-red-600 hover:underline">
                  취소
                </button>
              )}
            </td>
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * 추가 범위 입력 — 예비 태블릿(발주에만, 고객 미청구, D23), 본행사와 다른 날 리허설의 현장 인력(D24),
 * 관리자가 정한 숙박 박수·인원(권역 1박 금액, D26).
 */
export const ScopeExtrasFields: FC<{
  value: ScopeExtrasDraft;
  onChange: (next: ScopeExtrasDraft) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const field = (key: keyof ScopeExtrasDraft, label: string, hint: string) => (
    <Field label={label}>
      <FormattedNumberInput
        value={value[key]}
        onChange={(next) => onChange({ ...value, [key]: next })}
        min={0}
        disabled={disabled}
        placeholder="0"
        className={inputClass}
      />
      <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
    </Field>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {field('spareTabletCount', '예비 태블릿(대)', '발주에만 넣고 고객에게는 청구하지 않습니다.')}
      {field('rehearsalStaffPersonDays', '리허설 현장 인력(인·일)', '본행사와 다른 날 방문할 때만. 같은 날 리허설은 넣지 않습니다.')}
      {field('lodgingNights', '숙박(박)', '숙박이 필요할 때 박수와 인원을 함께 넣습니다.')}
      {field('lodgingPersons', '숙박 인원(명)', '권역 할증표의 1박 금액 × 박수 × 인원입니다.')}
    </div>
  );
};

/**
 * 직접 입력 항목 — 카탈로그에 없는 품목을 이름·수량·고객 단가로 견적에 넣는다(파트너 고객 견적의 "기타(직접 입력)"와
 * 같은 방식). 발주 단가를 넣으면 수량을 곱해 발주 금액에 더하고, 비우면 0(플랫폼이 처리)이다.
 */
export const CustomItemsField: FC<{
  value: CustomItemDraft[];
  onChange: (next: CustomItemDraft[]) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const updateItem = (index: number, patch: Partial<CustomItemDraft>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-gray-500">
          직접 입력 항목
          <span className="ml-2 font-normal text-amber-700">
            발주 단가를 입력해야 파트너 발주 금액과 예상 마진에 반영됩니다(비우면 0원).
          </span>
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...value, EMPTY_CUSTOM_ITEM_DRAFT])}
          disabled={disabled}
          className="shrink-0 whitespace-nowrap"
        >
          <Plus size={12} /> 항목 추가
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-gray-400">카탈로그에 없는 품목을 이름과 단가로 직접 넣을 수 있습니다.</p>
      ) : (
        <ul className="space-y-2">
          <li className="hidden sm:grid grid-cols-[1fr_5rem_7rem_7rem_2rem] gap-2 text-[11px] text-gray-400">
            <span>품목명</span>
            <span>수량</span>
            <span>고객 단가</span>
            <span>발주 단가</span>
            <span />
          </li>
          {value.map((item, index) => (
            <li key={index} className="grid grid-cols-2 sm:grid-cols-[1fr_5rem_7rem_7rem_2rem] gap-2 items-center">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                maxLength={200}
                placeholder="품목명"
                disabled={disabled}
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
              <FormattedNumberInput
                value={item.quantity}
                onChange={(next) => updateItem(index, { quantity: next })}
                min={1}
                disabled={disabled}
                placeholder="수량"
                className={inputClass}
              />
              <FormattedNumberInput
                value={item.unitPrice}
                onChange={(next) => updateItem(index, { unitPrice: next })}
                min={0}
                disabled={disabled}
                placeholder="고객 단가"
                className={inputClass}
              />
              <FormattedNumberInput
                value={item.partnerUnitPrice}
                onChange={(next) => updateItem(index, { partnerUnitPrice: next })}
                min={0}
                disabled={disabled}
                placeholder="발주 단가(없으면 0)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                disabled={disabled}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 justify-self-end"
                aria-label="직접 입력 항목 삭제"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface QuoteAdjustmentFieldProps {
  value: QuoteAdjustmentDraft;
  onChange: (next: QuoteAdjustmentDraft) => void;
  disabled?: boolean;
}

/**
 * 영업 할인 입력(방식 + 금액/율) — 퍼센트는 할인 전 공급가 소계에 곱한다(서버가 계산한다).
 * 금액 입력은 min-w-0으로 줄여 grid 칸 밖으로 넘치지 않게 한다.
 */
export const DiscountField: FC<QuoteAdjustmentFieldProps> = ({ value, onChange, disabled }) => (
  <Field label="영업 할인(공급가)">
    <div className="flex gap-2">
      {/* inputClass의 w-full이 너비 지정을 덮으므로 고정 너비는 감싸는 div가 맡는다. */}
      <div className="w-24 shrink-0">
        <select
          value={value.discountType}
          onChange={(e) => onChange({ ...value, discountType: e.target.value as DiscountType })}
          disabled={disabled}
          aria-label="할인 방식"
          className={`${inputClass} bg-white`}
        >
          {DISCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {value.discountType === 'PERCENT' ? (
        <div className="relative min-w-0 flex-1">
          <FormattedNumberInput
            value={value.discountRatePercent}
            onChange={(next) => onChange({ ...value, discountRatePercent: next })}
            min={0}
            max={100}
            step="0.01"
            disabled={disabled}
            placeholder="0"
            className={`${inputClass} pr-7`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <FormattedNumberInput
            value={value.discountAmount}
            onChange={(next) => onChange({ ...value, discountAmount: next })}
            min={0}
            disabled={disabled}
            placeholder="0"
            className={inputClass}
          />
        </div>
      )}
    </div>
  </Field>
);

/** 공급가 절사 단위 — 할인 뒤 공급가(부가세 별도)를 이 단위 미만에서 버리고, 부가세는 절사한 금액으로 계산한다(서버가 계산한다). */
export const TruncationField: FC<QuoteAdjustmentFieldProps> = ({ value, onChange, disabled }) => (
  <Field label="공급가 절사(부가세 별도)">
    <select
      value={value.truncationUnit}
      onChange={(e) => onChange({ ...value, truncationUnit: e.target.value })}
      disabled={disabled}
      className={`${inputClass} bg-white`}
    >
      {TRUNCATION_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </Field>
);

/**
 * 견적 계산 결과 — 할인 전 소계, 영업 할인, 절사, 공급가·부가세·합계. 기본 단가표 기준 예상 마진은 견적 작성에서만
 * 보인다(범위 변경은 수락된 발주 단가로 마진을 검사하므로 `showMargin`을 끈다). `currentTotalAmount`를 주면 지금 합계와의 차이를 함께 보인다.
 */
export const QuotePreview: FC<{
  preview: MarginSimulation | null;
  error: string | null;
  isLoading: boolean;
  showMargin?: boolean;
  currentTotalAmount?: number;
}> = ({ preview, error, isLoading, showMargin = true, currentTotalAmount }) => {
  if (!preview) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400 flex items-center gap-1.5">
        {isLoading && <Loader2 size={12} className="animate-spin" />}
        {isLoading ? '계산 중...' : error}
      </div>
    );
  }
  const currency = preview.currencyCode;
  const discountLine = preview.lines.find((line) => line.lineType === 'DISCOUNT');
  const truncationLine = preview.lines.find((line) => line.lineType === 'TRUNCATION');
  const subtotal = preview.lines
    .filter((line) => line.lineType !== 'DISCOUNT' && line.lineType !== 'TRUNCATION')
    .reduce((sum, line) => sum + line.amount, 0);
  const { defaultQuote } = preview;
  return (
    <div className={`rounded-md bg-gray-50 px-3 py-2 text-sm ${isLoading ? 'opacity-60' : ''}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        계산 결과 {isLoading && <Loader2 size={12} className="animate-spin" />}
      </div>
      <dl className="space-y-1">
        <div className="flex justify-between"><dt className="text-gray-500">할인 전 공급가</dt><dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd></div>
        <div className="flex justify-between">
          <dt className="text-gray-500">{discountLine?.name ?? '영업 할인'}</dt>
          <dd className="tabular-nums text-red-600">{formatMoney(discountLine?.amount ?? 0, currency)}</dd>
        </div>
        {truncationLine && (
          <div className="flex justify-between">
            <dt className="text-gray-500">{truncationLine.name}</dt>
            <dd className="tabular-nums text-red-600">{formatMoney(truncationLine.amount, currency)}</dd>
          </div>
        )}
        <div className="flex justify-between"><dt className="text-gray-500">공급가</dt><dd className="tabular-nums">{formatMoney(preview.supplyAmount, currency)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-500">부가세</dt><dd className="tabular-nums">{formatMoney(preview.vatAmount, currency)}</dd></div>
        <div className="flex justify-between font-bold"><dt>합계</dt><dd className="tabular-nums">{formatMoney(preview.totalAmount, currency)}</dd></div>
        {currentTotalAmount !== undefined && (
          <div className="flex justify-between text-xs">
            <dt className="text-gray-500">지금 합계 {formatMoney(currentTotalAmount, currency)} 대비</dt>
            <dd className={`tabular-nums ${preview.totalAmount < currentTotalAmount ? 'text-red-600' : 'text-gray-700'}`}>
              {preview.totalAmount >= currentTotalAmount ? '+' : ''}{formatMoney(preview.totalAmount - currentTotalAmount, currency)}
            </dd>
          </div>
        )}
      </dl>
      {showMargin && defaultQuote.marginRatePercent !== null && (
        <p className={`mt-2 text-xs ${defaultQuote.marginSufficient === false ? 'text-red-600' : 'text-gray-500'}`}>
          예상 마진 {formatMoney(defaultQuote.marginAmount, currency)} ({defaultQuote.marginRatePercent}%, 기본 단가표 기준)
          {defaultQuote.marginSufficient === false && ` — 최소 마진율 ${preview.minimumMarginRatePercent}%에 못 미쳐 저장할 수 없습니다.`}
        </p>
      )}
    </div>
  );
};

/**
 * 견적서 문구 입력 — "제공 서비스" 본문과 하단 안내문구. 새 견적은 오늘의 견적 공통 문구로 채워지고 견적마다 고칠 수 있다.
 * {@code template}을 넘기면(새 견적) 공통 문구와 달라졌을 때 되돌리기 버튼을 보여준다.
 */
export const QuoteTextsField: FC<{
  serviceDescription: string;
  footerNotice: string;
  onChange: (next: { serviceDescription: string; quoteFooterNotice: string }) => void;
  template: QuoteTemplate | null;
  showMissingTemplateWarning: boolean;
  disabled: boolean;
}> = ({ serviceDescription, footerNotice, onChange, template, showMissingTemplateWarning, disabled }) => {
  const templateService = template?.serviceDescription ?? '';
  const templateFooter = template?.footerNotice ?? '';
  const differsFromTemplate = template !== null && (serviceDescription !== templateService || footerNotice !== templateFooter);
  return (
    <div className="space-y-3">
      {showMissingTemplateWarning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          오늘 유효한 견적 공통 문구가 없어 견적서 문구가 비어 있습니다. 필요하면 직접 입력하거나{' '}
          <Link to="/admin/quote-templates" className="font-medium underline">견적 공통 문구</Link>를 먼저 등록하세요.
        </p>
      )}
      <Field label="견적서 서비스 설명">
        <textarea
          value={serviceDescription}
          onChange={(e) => onChange({ serviceDescription: e.target.value, quoteFooterNotice: footerNotice })}
          disabled={disabled}
          rows={5}
          maxLength={5000}
          placeholder="고객 견적서의 &quot;제공 서비스&quot;에 보이는 설명입니다. 비우면 그 칸이 없습니다."
          className={`${inputClass} resize-y`}
        />
      </Field>
      <Field label="견적서 하단 안내문구">
        <textarea
          value={footerNotice}
          onChange={(e) => onChange({ serviceDescription, quoteFooterNotice: e.target.value })}
          disabled={disabled}
          rows={6}
          maxLength={2000}
          placeholder="견적서 맨 아래에 보이는 안내입니다. 비우면 그 줄이 없습니다."
          className={`${inputClass} resize-y`}
        />
      </Field>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-gray-400">
          새 견적은 오늘의 견적 공통 문구로 채워집니다. 이 견적에만 적용되고, 공통 문구를 나중에 바꿔도 이 견적은 그대로입니다.
        </p>
        {differsFromTemplate && (
          <button
            type="button"
            onClick={() => onChange({ serviceDescription: templateService, quoteFooterNotice: templateFooter })}
            disabled={disabled}
            className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-950 hover:underline"
          >
            공통 문구로 되돌리기
          </button>
        )}
      </div>
    </div>
  );
};
