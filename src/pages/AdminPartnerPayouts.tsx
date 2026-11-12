import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Banknote, CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { SearchBar, SearchField } from '../components/SearchBar';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { DetailRow, Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { OffsetTable, PartnerLedgerTable, PayoutItemsTable, PayoutStatusBadge } from './order/components';
import { PAYOUT_STATUS_LABEL, blankToNull, formatMoney, previousMonth } from './order/constants';
import type {
  PageResponse,
  PartnerLedger,
  PartnerOffsetSummary,
  PartnerPayoutDetail,
  PartnerPayoutStatus,
  PartnerPayoutSummary,
} from '../types';

const PAGE_SIZE = 20;

/** 브라우저 현지 날짜(YYYY-MM-DD) — 지급일 기본값. */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

type DetailAction = 'none' | 'paid' | 'cancel';

/**
 * 파트너 지급(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md
 * D11·D12. 지난달까지의 검수 승인월을 골라 정산하면 파트너별 지급 건이 생긴다. 이체는 시스템 밖에서
 * 하고, 이체 후 지급일·이체 금액을 기록한다(부가세·원천징수는 이체 금액에 반영). 이체 전에는 취소해
 * 다시 정산할 수 있다.
 *
 * <p>D13·D19(2026-11-12): 정산 때 대기 중인 귀책 상계를 지급액에서 빼고, 넘는 만큼은 이월한다. 지급액이
 * 1,000만 원 이상이면 PLATFORM_SUPER가 승인해야 지급 완료를 기록할 수 있다(정산을 만든 사람은 승인 불가).
 */
export const AdminPartnerPayouts: FC = () => {
  const canApprove = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_PAYMENT_APPROVE'));
  const canLargeApprove = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_PAYOUT_LARGE_APPROVE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [monthFilter, setMonthFilter] = useState(previousMonth());
  const [statusFilter, setStatusFilter] = useState<'ALL' | PartnerPayoutStatus>('ALL');
  const [applied, setApplied] = useState<{ month: string; status: 'ALL' | PartnerPayoutStatus }>({
    month: previousMonth(),
    status: 'ALL',
  });
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<PartnerPayoutSummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMonth, setCreateMonth] = useState(previousMonth());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detail, setDetail] = useState<PartnerPayoutDetail | null>(null);
  const [ledger, setLedger] = useState<PartnerLedger | null>(null);
  const [action, setAction] = useState<DetailAction>('none');
  const [paidDate, setPaidDate] = useState('');
  const [transferredAmount, setTransferredAmount] = useState('');
  const [paymentMemo, setPaymentMemo] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [pendingOffsets, setPendingOffsets] = useState<PartnerOffsetSummary[]>([]);
  const [offsetToCancel, setOffsetToCancel] = useState<PartnerOffsetSummary | null>(null);
  const [offsetCancelReason, setOffsetCancelReason] = useState('');

  const fetchPage = useCallback(async () => {
    const query = new URLSearchParams();
    if (applied.month) query.set('settlementMonth', applied.month);
    if (applied.status !== 'ALL') query.set('status', applied.status);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    query.set('sort', 'id,desc');
    const response = await api.get(`/platform-admin/partner-payouts?${query.toString()}`);
    return response.data as PageResponse<PartnerPayoutSummary>;
  }, [applied, page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPage();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '지급 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, showSnackbar]);

  const fetchPendingOffsets = useCallback(async () => {
    const response = await api.get('/platform-admin/partner-offsets?status=PENDING&size=50&sort=occurredOn,asc');
    return (response.data as PageResponse<PartnerOffsetSummary>).content;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const offsets = await fetchPendingOffsets();
        if (!cancelled) setPendingOffsets(offsets);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '상계 목록을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPendingOffsets, showSnackbar]);

  const handleCancelOffset = async (e: FormEvent) => {
    e.preventDefault();
    if (!offsetToCancel) return;
    if (!offsetCancelReason.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/platform-admin/partner-offsets/${offsetToCancel.id}/cancel`, { reason: offsetCancelReason.trim() });
      showSnackbar('상계를 취소했습니다.', 'success');
      setOffsetToCancel(null);
      setPendingOffsets(await fetchPendingOffsets());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '상계 취소에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setApplied({ month: monthFilter, status: statusFilter });
  };

  const handleReset = () => {
    setIsLoading(true);
    setMonthFilter(previousMonth());
    setStatusFilter('ALL');
    setPage(0);
    setApplied({ month: previousMonth(), status: 'ALL' });
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!createMonth) {
      showSnackbar('정산할 월을 선택해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post('/platform-admin/partner-payouts', { settlementMonth: createMonth });
      const created = response.data as PartnerPayoutSummary[];
      showSnackbar(
        created.length > 0 ? `${created.length}건의 지급을 만들었습니다.` : '정산할 검수 승인 건이 없습니다.',
        created.length > 0 ? 'success' : 'info',
      );
      setIsCreateOpen(false);
      setPendingOffsets(await fetchPendingOffsets());
      setIsLoading(true);
      setMonthFilter(createMonth);
      setPage(0);
      setApplied({ month: createMonth, status: 'ALL' });
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '정산에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = async (payoutId: number, organizationId: number) => {
    setAction('none');
    try {
      const [detailResponse, ledgerResponse] = await Promise.all([
        api.get(`/platform-admin/partner-payouts/${payoutId}`),
        api.get(`/platform-admin/partner-payouts/ledger?organizationId=${organizationId}&size=10`),
      ]);
      setDetail(detailResponse.data as PartnerPayoutDetail);
      setLedger(ledgerResponse.data as PartnerLedger);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '지급 상세를 불러오지 못했습니다.', 'error');
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setLedger(null);
    setAction('none');
  };

  const startPaid = () => {
    if (!detail) return;
    setPaidDate(localToday());
    setTransferredAmount(String(detail.summary.amount));
    setPaymentMemo('');
    setAction('paid');
  };

  const afterAction = async (updated: PartnerPayoutDetail, message: string) => {
    showSnackbar(message, 'success');
    setAction('none');
    setDetail(updated);
    const [data, ledgerResponse] = await Promise.all([
      fetchPage(),
      api.get(`/platform-admin/partner-payouts/ledger?organizationId=${updated.summary.organizationId}&size=10`),
    ]);
    setPageData(data);
    setLedger(ledgerResponse.data as PartnerLedger);
  };

  const handleMarkPaid = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!paidDate || transferredAmount === '') {
      showSnackbar('지급일과 이체 금액을 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`/platform-admin/partner-payouts/${detail.summary.id}/mark-paid`, {
        paidDate,
        transferredAmount: Number(transferredAmount),
        paymentMemo: blankToNull(paymentMemo),
      });
      await afterAction(response.data as PartnerPayoutDetail, '지급 완료로 기록했습니다.');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '지급 기록에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setIsSubmitting(true);
    try {
      const response = await api.post(`/platform-admin/partner-payouts/${detail.summary.id}/approve`);
      await afterAction(response.data as PartnerPayoutDetail, '고액 지급을 승인했습니다.');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '승인에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!cancelReason.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`/platform-admin/partner-payouts/${detail.summary.id}/cancel`, {
        reason: cancelReason.trim(),
      });
      await afterAction(response.data as PartnerPayoutDetail, '지급을 취소했습니다. 검수·상계 건은 다시 정산할 수 있습니다.');
      setPendingOffsets(await fetchPendingOffsets());
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '취소에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const payouts = pageData?.content ?? [];
  const summary = detail?.summary;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Banknote size={20} className="text-gray-400" />
            파트너 지급
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            검수 승인월 단위로 파트너별 지급 건을 만듭니다. 지급 기한은 다음 달 말일(승인일부터 60일 이내)입니다.
          </p>
        </div>
        {canApprove && (
          <Button onClick={() => { setCreateMonth(previousMonth()); setIsCreateOpen(true); }}>
            <Banknote size={14} /> 월 정산
          </Button>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="승인월">
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={inputClass} />
        </SearchField>
        <SearchField label="상태">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | PartnerPayoutStatus)}
            className={`${inputClass} bg-white`}
          >
            <option value="ALL">전체</option>
            {Object.entries(PAYOUT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={payouts.length === 0}
        emptyMessage="지급 건이 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: (nextPage) => {
                  setIsLoading(true);
                  setPage(nextPage);
                },
              }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">승인월</th>
              <th className="text-left px-4 py-3 font-medium">파트너</th>
              <th className="text-right px-4 py-3 font-medium">지급액(공급가)</th>
              <th className="text-left px-4 py-3 font-medium">지급 기한</th>
              <th className="text-left px-4 py-3 font-medium">정산 계좌</th>
              <th className="text-left px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payouts.map((payout) => (
              <tr
                key={payout.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => openDetail(payout.id, payout.organizationId)}
              >
                <td className="px-4 py-3">{payout.settlementMonth}</td>
                <td className="px-4 py-3 text-gray-950 font-medium">{payout.organizationName}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(payout.amount, payout.currencyCode)}
                  {payout.offsetAmount > 0 && (
                    <p className="text-xs text-gray-400">상계 {formatMoney(-payout.offsetAmount, payout.currencyCode)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{payout.dueDate}</td>
                <td className="px-4 py-3 text-gray-500">
                  {payout.bankName ? `${payout.bankName} ${payout.bankAccountNumber ?? ''}` : '미등록'}
                </td>
                <td className="px-4 py-3">
                  <PayoutStatusBadge status={payout.status} />
                  {payout.awaitingApproval && payout.status === 'CONFIRMED' && (
                    <p className="text-xs text-red-600">고액 승인 대기</p>
                  )}
                  {payout.paidDate && <p className="text-xs text-gray-400">{payout.paidDate} 지급</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <section className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950">정산 대기 귀책 상계</h2>
        <p className="mt-1 mb-2 text-xs text-gray-500">
          수주 상세의 발주에서 등록합니다. 다음 월 정산에서 해당 파트너 지급액에서 빼고, 지급액을 넘으면 이월합니다.
        </p>
        {pendingOffsets.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">대기 중인 상계가 없습니다.</p>
        ) : (
          <OffsetTable
            offsets={pendingOffsets}
            showPartner
            onCancel={canApprove ? (offset) => { setOffsetCancelReason(''); setOffsetToCancel(offset); } : undefined}
          />
        )}
      </section>

      <Modal open={offsetToCancel !== null} onClose={() => setOffsetToCancel(null)} title="상계 취소" widthClassName="max-w-sm">
        {offsetToCancel && (
          <form onSubmit={handleCancelOffset} className="space-y-3">
            <p className="text-sm text-gray-700">
              {offsetToCancel.organizationName} · {offsetToCancel.title} · {formatMoney(offsetToCancel.amount, offsetToCancel.currencyCode)}
            </p>
            <Field label="취소 사유">
              <input
                value={offsetCancelReason}
                onChange={(e) => setOffsetCancelReason(e.target.value)}
                maxLength={500}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <p className="text-xs text-gray-400">원장에 상계 취소(+)가 남습니다.</p>
            <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="상계 취소" onCancel={() => setOffsetToCancel(null)} />
          </form>
        )}
      </Modal>

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="월 정산" widthClassName="max-w-sm">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="검수 승인월">
            <input
              type="month"
              value={createMonth}
              max={previousMonth()}
              onChange={(e) => setCreateMonth(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-gray-500">
            그 달 말일까지 검수 승인된 건 중 아직 정산되지 않은 건을 파트너별로 합산하고, 대기 중인 귀책 상계를 뺍니다.
            감액 후 이의 기간(7일)이 남았거나 이의 제기 중인 건은 다음 정산으로 넘깁니다. 정산 계좌는 지금 등록된
            계좌로 고정됩니다.
          </p>
          <FormActions isSaving={isSubmitting} savingLabel="정산 중..." saveLabel="정산" onCancel={() => setIsCreateOpen(false)} />
        </form>
      </Modal>

      <Modal open={detail !== null} onClose={closeDetail} title="지급 상세" widthClassName="max-w-3xl">
        {detail && summary && (
          <div className="space-y-4">
            <section className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <DetailRow label="파트너" value={`${summary.organizationName} · ${summary.settlementMonth} 승인분`} />
              <DetailRow label="상태" value={<PayoutStatusBadge status={summary.status} />} />
              <DetailRow label="검수 합계(공급가)" value={formatMoney(summary.grossAmount, summary.currencyCode)} />
              {summary.offsetAmount > 0 && (
                <DetailRow label="귀책 상계" value={formatMoney(-summary.offsetAmount, summary.currencyCode)} />
              )}
              <DetailRow label="지급액(공급가)" value={formatMoney(summary.amount, summary.currencyCode)} />
              <DetailRow label="지급 기한" value={summary.dueDate} />
              {summary.approvalRequired && (
                <DetailRow
                  label="고액 지급 승인"
                  value={summary.approvedAt ? `승인됨 (${summary.approvedAt.slice(0, 10)})` : 'PLATFORM_SUPER 승인 대기'}
                />
              )}
              <DetailRow
                label="정산 계좌"
                value={summary.bankName
                  ? `${summary.bankName} ${summary.bankAccountNumber ?? ''} (${summary.accountHolderName ?? ''})`
                  : '미등록'}
              />
              {summary.paidDate && (
                <DetailRow
                  label="지급"
                  value={`${summary.paidDate} · 이체 ${formatMoney(summary.transferredAmount, summary.currencyCode)}${summary.paymentMemo ? ` · ${summary.paymentMemo}` : ''}`}
                />
              )}
              {summary.cancellationReason && <DetailRow label="취소 사유" value={summary.cancellationReason} />}
            </section>

            {detail.items.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-950 mb-1">검수 항목</h3>
                <PayoutItemsTable items={detail.items} linkTo={(item) => `/admin/sales-orders/${item.salesOrderId}`} />
              </section>
            )}

            {detail.offsets.length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-950 mb-1">반영된 귀책 상계</h3>
                <OffsetTable offsets={detail.offsets} />
              </section>
            )}

            {summary.status === 'CONFIRMED' && action === 'none' && (canApprove || canLargeApprove) && (
              <div className="flex flex-wrap justify-end gap-2">
                {canApprove && (
                  <Button variant="danger-outline" size="sm" onClick={() => { setCancelReason(''); setAction('cancel'); }}>
                    <XCircle size={12} /> 지급 취소
                  </Button>
                )}
                {summary.awaitingApproval && canLargeApprove && (
                  <Button size="sm" onClick={handleApprove} disabled={isSubmitting}>
                    <ShieldCheck size={12} /> 고액 지급 승인
                  </Button>
                )}
                {canApprove && !summary.awaitingApproval && (
                  <Button size="sm" onClick={startPaid}>
                    <CheckCircle2 size={12} /> 지급 완료 기록
                  </Button>
                )}
              </div>
            )}
            {summary.status === 'CONFIRMED' && summary.awaitingApproval && (
              <p className="text-right text-xs text-gray-400">
                고액 지급은 정산을 만든 사람이 아닌 PLATFORM_SUPER가 승인한 뒤에 지급 완료를 기록할 수 있습니다.
              </p>
            )}

            {action === 'paid' && (
              <form onSubmit={handleMarkPaid} className="space-y-3 border-t border-gray-200 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="지급일">
                    <input
                      type="date"
                      value={paidDate}
                      max={localToday()}
                      onChange={(e) => setPaidDate(e.target.value)}
                      disabled={isSubmitting}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="이체 금액(부가세·원천징수 반영)">
                    <FormattedNumberInput
                      value={transferredAmount}
                      onChange={setTransferredAmount}
                      min={0}
                      disabled={isSubmitting}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="메모(선택)">
                  <input
                    value={paymentMemo}
                    onChange={(e) => setPaymentMemo(e.target.value)}
                    maxLength={500}
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                </Field>
                <FormActions isSaving={isSubmitting} savingLabel="기록 중..." saveLabel="지급 완료" onCancel={() => setAction('none')} />
              </form>
            )}

            {action === 'cancel' && (
              <form onSubmit={handleCancel} className="space-y-3 border-t border-gray-200 pt-3">
                <Field label="취소 사유">
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={500}
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                </Field>
                <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="지급 취소" onCancel={() => setAction('none')} />
              </form>
            )}

            <section className="border-t border-gray-200 pt-3">
              <h3 className="text-sm font-bold text-gray-950 mb-1">{summary.organizationName} 원장(최근 10건)</h3>
              {ledger ? (
                <PartnerLedgerTable ledger={ledger} />
              ) : (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};
