import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, Wallet } from 'lucide-react';
import { Button } from '../../components/Button';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { Modal } from '../../components/Modal';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { Field, FormActions } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import {
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
  INVOICE_TYPE_LABEL,
  blankToNull,
  formatMoney,
  localIsoDate,
  statusBadgeClass,
} from './constants';
import type {
  CustomerInvoiceStatus,
  CustomerInvoiceSummary,
  CustomerInvoiceType,
  CustomerRefundSummary,
  DiscountType,
  SalesOrderBilling,
} from '../../types';

/*
 * 고객 청구·수납 화면 공용 — signstage-docs business/platform-order-partner-subcontract-review.md D12·D16.
 * 수주 상세의 청구 섹션과 "청구·수납" 목록이 같은 표·처리 팝업을 쓴다.
 */

/** 입금 기한이 지난 입금 대기 건은 "미수"로 보여준다. */
export const InvoiceStatusBadge: FC<{ status: CustomerInvoiceStatus; overdue?: boolean }> = ({ status, overdue }) =>
  overdue ? (
    <span className={`${statusBadgeClass} bg-red-50 text-red-700 border-red-200`}>미수</span>
  ) : (
    <span className={`${statusBadgeClass} ${INVOICE_STATUS_STYLE[status]}`}>{INVOICE_STATUS_LABEL[status]}</span>
  );

type InvoiceAction = { kind: 'payment' | 'tax' | 'cancel'; invoice: CustomerInvoiceSummary };

interface InvoiceTableProps {
  invoices: CustomerInvoiceSummary[];
  /** 목록 화면처럼 여러 수주가 섞여 있으면 수주·고객 열을 보여준다. */
  showSalesOrder?: boolean;
  onChanged: (updated: CustomerInvoiceSummary) => void;
}

/** 청구 표 — 입금 기록·세금계산서 기록·취소를 팝업으로 처리한다(ACTION_CUSTOMER_INVOICE_MANAGE). */
export const InvoiceTable: FC<InvoiceTableProps> = ({ invoices, showSalesOrder, onChanged }) => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_CUSTOMER_INVOICE_MANAGE'));
  const [action, setAction] = useState<InvoiceAction | null>(null);

  return (
    <>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {showSalesOrder && <th className="text-left px-4 py-3 font-medium">수주 · 고객</th>}
            <th className="text-left px-4 py-3 font-medium">구분</th>
            <th className="text-right px-4 py-3 font-medium">청구 금액</th>
            <th className="text-left px-4 py-3 font-medium">발행 · 입금 기한</th>
            <th className="text-left px-4 py-3 font-medium">상태</th>
            <th className="text-left px-4 py-3 font-medium">세금계산서</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className={invoice.status === 'CANCELLED' ? 'text-gray-400' : ''}>
              {showSalesOrder && (
                <td className="px-4 py-3">
                  <Link to={`/admin/sales-orders/${invoice.salesOrderId}`} className="text-gray-950 font-medium hover:underline">
                    {invoice.salesOrderTitle}
                  </Link>
                  <p className="text-xs text-gray-400">{invoice.customerName}</p>
                </td>
              )}
              <td className="px-4 py-3">{INVOICE_TYPE_LABEL[invoice.invoiceType]}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatMoney(invoice.totalAmount, invoice.currencyCode)}
                <p className="text-xs text-gray-400">
                  공급가 {formatMoney(invoice.supplyAmount, invoice.currencyCode)} + 부가세 {formatMoney(invoice.vatAmount, invoice.currencyCode)}
                </p>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {invoice.issueDate}
                <p className="text-xs text-gray-400">{invoice.dueDate}까지</p>
              </td>
              <td className="px-4 py-3">
                <InvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
                {invoice.paidDate && (
                  <p className="text-xs text-gray-400">
                    {invoice.paidDate} {formatMoney(invoice.paidAmount, invoice.currencyCode)}
                  </p>
                )}
                {invoice.cancellationReason && <p className="text-xs text-gray-400">{invoice.cancellationReason}</p>}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {invoice.taxInvoiceIssuedDate ? (
                  <>
                    {invoice.taxInvoiceIssuedDate}
                    <p className="text-xs text-gray-400">{invoice.taxInvoiceApprovalNumber}</p>
                  </>
                ) : (
                  '-'
                )}
              </td>
              <td className="px-4 py-3">
                {canManage && invoice.status !== 'CANCELLED' && (
                  <div className="flex justify-end gap-1.5">
                    {invoice.status === 'ISSUED' && (
                      <Button size="sm" onClick={() => setAction({ kind: 'payment', invoice })}>입금 기록</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'tax', invoice })}>
                      세금계산서
                    </Button>
                    {invoice.status === 'ISSUED' && (
                      <Button size="sm" variant="danger-outline" onClick={() => setAction({ kind: 'cancel', invoice })}>
                        취소
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <InvoiceActionModal
        action={action}
        onClose={() => setAction(null)}
        onDone={(updated) => {
          setAction(null);
          onChanged(updated);
        }}
      />
    </>
  );
};

const InvoiceActionModal: FC<{
  action: InvoiceAction | null;
  onClose: () => void;
  onDone: (updated: CustomerInvoiceSummary) => void;
}> = ({ action, onClose, onDone }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openedFor, setOpenedFor] = useState<InvoiceAction | null>(null);

  // 팝업이 새 건으로 열릴 때 입력을 초기화한다(렌더 중 비교 — effect 안 setState를 피한다).
  if (action !== openedFor) {
    setOpenedFor(action);
    if (action) {
      setDate(action.kind === 'tax' ? action.invoice.taxInvoiceIssuedDate ?? localIsoDate() : localIsoDate());
      setAmount(action.kind === 'payment' ? String(action.invoice.totalAmount) : '');
      setText(action.kind === 'tax' ? action.invoice.taxInvoiceApprovalNumber ?? '' : '');
    }
  }

  if (!action) return null;
  const { invoice, kind } = action;
  const title = kind === 'payment' ? '입금 기록' : kind === 'tax' ? '세금계산서 발행 기록' : '청구 취소';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (kind !== 'cancel' && !date) {
      showSnackbar('날짜를 입력해주세요.', 'error');
      return;
    }
    if (kind === 'payment' && amount === '') {
      showSnackbar('입금액을 입력해주세요.', 'error');
      return;
    }
    if (kind !== 'payment' && !text.trim()) {
      showSnackbar(kind === 'tax' ? '승인번호를 입력해주세요.' : '취소 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const base = `/platform-admin/customer-invoices/${invoice.id}`;
      const response =
        kind === 'payment'
          ? await api.post(`${base}/payment`, { paidDate: date, paidAmount: Number(amount), paymentMemo: blankToNull(text) })
          : kind === 'tax'
            ? await api.post(`${base}/tax-invoice`, { issuedDate: date, approvalNumber: text.trim() })
            : await api.post(`${base}/cancel`, { reason: text.trim() });
      showSnackbar(kind === 'payment' ? '입금을 기록했습니다.' : kind === 'tax' ? '세금계산서 발행을 기록했습니다.' : '청구를 취소했습니다.', 'success');
      onDone(response.data as CustomerInvoiceSummary);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '처리에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} widthClassName="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-gray-700">
          {invoice.salesOrderTitle} · {INVOICE_TYPE_LABEL[invoice.invoiceType]} {formatMoney(invoice.totalAmount, invoice.currencyCode)}
        </p>
        {kind !== 'cancel' && (
          <Field label={kind === 'payment' ? '입금일' : '발행일'}>
            <input
              type="date"
              value={date}
              max={kind === 'payment' ? localIsoDate() : undefined}
              onChange={(e) => setDate(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
        )}
        {kind === 'payment' && (
          <Field label="입금액">
            <FormattedNumberInput value={amount} onChange={setAmount} min={0} disabled={isSubmitting} className={inputClass} />
          </Field>
        )}
        <Field label={kind === 'payment' ? '메모(선택)' : kind === 'tax' ? '승인번호' : '취소 사유'}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={kind === 'tax' ? 50 : 500}
            disabled={isSubmitting}
            className={inputClass}
          />
        </Field>
        {kind === 'tax' && <p className="text-xs text-gray-400">세금계산서는 홈택스 등에서 발행하고 여기에는 기록만 남깁니다.</p>}
        <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel={kind === 'cancel' ? '청구 취소' : '기록'} onCancel={onClose} />
      </form>
    </Modal>
  );
};

/**
 * 수주 상세의 청구 섹션 — 선금(수주 확정 후, 수주 금액의 퍼센트 또는 정액)과 잔금(행사 완료 후 나머지)을
 * 발행하고 입금·세금계산서를 기록한다(D12·D16). 선금은 기본 선금 비율로 시작한다.
 */
export const SalesOrderBillingSection: FC<{ salesOrderId: number; refreshKey?: unknown }> = ({ salesOrderId, refreshKey }) => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_CUSTOMER_INVOICE_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [billing, setBilling] = useState<SalesOrderBilling | null>(null);
  const [issueType, setIssueType] = useState<CustomerInvoiceType | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [advanceAmountType, setAdvanceAmountType] = useState<DiscountType>('PERCENT');
  const [advanceValue, setAdvanceValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundTarget, setRefundTarget] = useState<CustomerRefundSummary | null>(null);
  const [refundedDate, setRefundedDate] = useState('');
  const [refundMemo, setRefundMemo] = useState('');

  const endpoint = `/platform-admin/sales-orders/${salesOrderId}/invoices`;

  const load = useCallback(async () => {
    const response = await api.get(endpoint);
    return response.data as SalesOrderBilling;
  }, [endpoint]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) setBilling(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '청구 현황을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, showSnackbar, refreshKey]);

  const openIssue = (type: CustomerInvoiceType) => {
    setDueDate(localIsoDate(type === 'ADVANCE' ? 7 : 14));
    setAdvanceAmountType('PERCENT');
    setAdvanceValue(billing ? String(Math.round(billing.advancePaymentRate * 100)) : '');
    setIssueType(type);
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!issueType || !dueDate) return;
    const isAdvance = issueType === 'ADVANCE';
    if (isAdvance && !(Number(advanceValue) > 0)) {
      showSnackbar(advanceAmountType === 'PERCENT' ? '선금 비율을 입력해주세요.' : '선금 금액을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(endpoint, {
        invoiceType: issueType,
        dueDate,
        advanceAmountType: isAdvance ? advanceAmountType : null,
        advanceValue: isAdvance ? Number(advanceValue) : null,
      });
      setBilling(response.data as SalesOrderBilling);
      setIssueType(null);
      showSnackbar(`${INVOICE_TYPE_LABEL[issueType]}을 청구했습니다.`, 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '청구에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordRefund = async (e: FormEvent) => {
    e.preventDefault();
    if (!refundTarget || !refundedDate) return;
    setIsSubmitting(true);
    try {
      const response = await api.post(`/platform-admin/customer-refunds/${refundTarget.id}/refunded`, {
        refundedDate,
        refundMemo: blankToNull(refundMemo),
      });
      setBilling(response.data as SalesOrderBilling);
      setRefundTarget(null);
      showSnackbar('환불 완료를 기록했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '환불 기록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!billing) return null;
  const currency = billing.currencyCode;
  const ratePercent = Math.round(billing.advancePaymentRate * 100);

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Wallet size={14} className="text-gray-400" /> 청구·수납
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            계약 {formatMoney(billing.contractAmount, currency)} · 청구 {formatMoney(billing.billedAmount, currency)} · 입금{' '}
            {formatMoney(billing.paidAmount, currency)} · 미입금 {formatMoney(billing.outstandingAmount, currency)}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {billing.advanceIssuable && (
              <Button size="sm" variant="secondary" onClick={() => openIssue('ADVANCE')}>
                <Receipt size={12} /> 선금 청구
              </Button>
            )}
            {billing.balanceIssuable && (
              <Button size="sm" onClick={() => openIssue('BALANCE')}>
                <Receipt size={12} /> 잔금 청구
              </Button>
            )}
          </div>
        )}
      </div>
      {billing.invoices.length === 0 ? (
        <p className="text-sm text-gray-400">
          청구 내역이 없습니다. 선금은 수주 확정 후, 잔금은 행사가 완료된 뒤 청구합니다.
        </p>
      ) : (
        <div className="-mx-4">
          <InvoiceTable
            invoices={billing.invoices}
            onChanged={async () => {
              try {
                setBilling(await load());
              } catch {
                /* 다음 조회 때 갱신된다 */
              }
            }}
          />
        </div>
      )}
      {billing.cancelledByCustomer && (
        <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
          <p className="text-gray-700">
            고객 취소 · 취소 수수료 {billing.cancellationFeeRatePercent ?? 0}%{' '}
            {formatMoney(billing.cancellationFeeAmount ?? 0, currency)}(공급가 기준, 부가세 없음)
          </p>
          {billing.refunds.map((refund) => (
            <div key={refund.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2">
              <div>
                <p className="font-medium text-gray-950">환불 {formatMoney(refund.amount, currency)}</p>
                <p className="text-xs text-gray-500">
                  {refund.status === 'REFUNDED'
                    ? `${refund.refundedDate} 환불 완료${refund.refundMemo ? ` · ${refund.refundMemo}` : ''}`
                    : '환불 대기 — 시스템 밖에서 환불한 뒤 환불일을 기록합니다.'}
                </p>
              </div>
              {canManage && refund.status === 'PENDING' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setRefundedDate(localIsoDate());
                    setRefundMemo('');
                    setRefundTarget(refund);
                  }}
                >
                  환불 완료 기록
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {!billing.eventCompleted && !billing.cancelledByCustomer && billing.invoices.some((invoice) => invoice.invoiceType === 'ADVANCE') && (
        <p className="mt-2 text-xs text-gray-400">잔금은 행사가 완료되면 청구할 수 있습니다.</p>
      )}

      <Modal open={issueType !== null} onClose={() => setIssueType(null)} title={issueType ? `${INVOICE_TYPE_LABEL[issueType]} 청구` : ''} widthClassName="max-w-sm">
        <form onSubmit={handleIssue} className="space-y-3">
          {issueType === 'ADVANCE' ? (
            <>
              <Field label="선금 금액">
                <div className="flex gap-2">
                  <div className="w-24 shrink-0">
                    <select
                      value={advanceAmountType}
                      onChange={(e) => {
                        const type = e.target.value as DiscountType;
                        setAdvanceAmountType(type);
                        setAdvanceValue(type === 'PERCENT' ? String(ratePercent) : '');
                      }}
                      disabled={isSubmitting}
                      className={`${inputClass} bg-white`}
                    >
                      <option value="PERCENT">퍼센트</option>
                      <option value="FIXED_AMOUNT">정액</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <FormattedNumberInput
                      value={advanceValue}
                      onChange={setAdvanceValue}
                      min={0}
                      max={advanceAmountType === 'PERCENT' ? 99 : undefined}
                      disabled={isSubmitting}
                      placeholder={advanceAmountType === 'PERCENT' ? '%' : '부가세 포함 금액'}
                      className={inputClass}
                    />
                  </div>
                </div>
              </Field>
              <p className="text-xs text-gray-500">
                {advanceAmountType === 'PERCENT'
                  ? `수주 금액(${formatMoney(billing.contractAmount, currency)})의 ${advanceValue || 0}%`
                    + `, 약 ${formatMoney(billing.contractAmount * (Number(advanceValue) || 0) / 100, currency)}를 청구합니다.`
                  : `부가세 포함 금액을 입력합니다. 수주 금액(${formatMoney(billing.contractAmount, currency)})보다 작아야 하며,`
                    + ' 공급가·부가세는 수주와 같은 비율로 나뉩니다.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-700">수주 금액에서 선금을 뺀 나머지를 잔금으로 청구합니다.</p>
          )}
          <Field label="입금 기한">
            <input
              type="date"
              value={dueDate}
              min={localIsoDate()}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="청구 중..." saveLabel="청구" onCancel={() => setIssueType(null)} />
        </form>
      </Modal>

      <Modal open={refundTarget !== null} onClose={() => setRefundTarget(null)} title="환불 완료 기록" widthClassName="max-w-sm">
        {refundTarget && (
          <form onSubmit={handleRecordRefund} className="space-y-3">
            <p className="text-sm text-gray-700">고객에게 {formatMoney(refundTarget.amount, currency)}를 환불한 날을 기록합니다.</p>
            <Field label="환불일">
              <input
                type="date"
                value={refundedDate}
                max={localIsoDate()}
                onChange={(e) => setRefundedDate(e.target.value)}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <Field label="메모(선택)">
              <input
                value={refundMemo}
                onChange={(e) => setRefundMemo(e.target.value)}
                maxLength={500}
                placeholder="환불 계좌·방법 등"
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <FormActions isSaving={isSubmitting} savingLabel="기록 중..." saveLabel="기록" onCancel={() => setRefundTarget(null)} />
          </form>
        )}
      </Modal>
    </section>
  );
};
