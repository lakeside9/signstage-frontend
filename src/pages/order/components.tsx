import type { FC } from 'react';
import type { PartnerOrderStatus, SalesOrderStatus } from '../../types';
import {
  PARTNER_ORDER_STATUS_LABEL,
  PARTNER_ORDER_STATUS_STYLE,
  SALES_ORDER_STATUS_LABEL,
  SALES_ORDER_STATUS_STYLE,
  formatMoney,
  statusBadgeClass,
} from './constants';

export const SalesOrderStatusBadge: FC<{ status: SalesOrderStatus }> = ({ status }) => (
  <span className={`${statusBadgeClass} ${SALES_ORDER_STATUS_STYLE[status]}`}>{SALES_ORDER_STATUS_LABEL[status]}</span>
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
}

/** 발주 금액 = 기본 수행비 + 태블릿 대수 × 대당 단가 + 현장 인력 인·일 × 일당 + 지역 할증 ± 조정(D05). */
export const PartnerOrderAmountBreakdown: FC<PartnerOrderAmountBreakdownProps> = (amount) => {
  const rows: Array<[string, string]> = [
    ['기본 수행비', formatMoney(amount.baseFee, amount.currencyCode)],
    [
      `태블릿 ${amount.tabletCount}대 × ${formatMoney(amount.tabletUnitRate, amount.currencyCode)}`,
      formatMoney(amount.tabletCount * amount.tabletUnitRate, amount.currencyCode),
    ],
    [
      `현장 인력 ${amount.onsiteStaffPersonDays}인·일 × ${formatMoney(amount.onsiteStaffDayRate, amount.currencyCode)}`,
      formatMoney(amount.onsiteStaffPersonDays * amount.onsiteStaffDayRate, amount.currencyCode),
    ],
    ['지역 할증', formatMoney(amount.regionSurcharge, amount.currencyCode)],
  ];
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
