import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import type {
  InspectionStatus,
  OrderInspectionSummary,
  PartnerLedger,
  PartnerOffsetSummary,
  PartnerOrderStatus,
  PartnerPayoutStatus,
  SalesOrderChangeStatus,
  SalesOrderStatus,
} from '../../types';
import { DetailRow, Field } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import type { ScopeExtrasDraft } from './constants';
import {
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
}

/**
 * 발주 금액 = 기본 수행비 + (태블릿 + 예비) × 대당 단가 + (현장 인력 + 리허설 별도일) × 일당 + 지역 할증
 * + 숙박 인·박 × 1박 단가 ± 조정(D05·D23·D24·D26).
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
  if (lodging > 0) {
    rows.push([
      `숙박 ${lodging}인·박 × ${formatMoney(amount.lodgingNightRate ?? 0, amount.currencyCode)}`,
      formatMoney(lodging * (amount.lodgingNightRate ?? 0), amount.currencyCode),
    ]);
  }
  if (amount.adjustmentAmount !== 0) {
    rows.push([
      `조정${amount.adjustmentReason ? ` (${amount.adjustmentReason})` : ''}`,
      formatMoney(amount.adjustmentAmount, amount.currencyCode),
    ]);
  }
  return (
    <dl className="text-sm divide-y divide-gray-100">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 py-1.5">
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
