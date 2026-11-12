import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Copy, FileText, Loader2, Pencil, Send, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { PartnerOrderAmountBreakdown, PartnerOrderStatusBadge, SalesOrderStatusBadge } from './order/components';
import { SalesOrderBillingSection } from './order/invoiceComponents';
import { SalesOrderChangeSection } from './order/SalesOrderChangeSection';
import {
  ACCEPTANCE_CHANNEL_LABEL,
  REGION_LABEL,
  blankToNull,
  formatMoney,
  formatSchedule,
  formatScopeExtras,
  formatWallDateTime,
} from './order/constants';
import type {
  AdminPartnerOrderSummary,
  AdminSalesOrderDetail as SalesOrderDetail,
  PageResponse,
  PartnerOrderPreview,
  PlatformAdminOrganizationSummary,
} from '../types';

/** 기본 응답 기한: 지금부터 2일 뒤 18:00(현지 벽시계). */
const defaultResponseDueAt = () => {
  const due = new Date();
  due.setDate(due.getDate() + 2);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T18:00`;
};

const quoteLinkOf = (token: string) => `${window.location.origin}/sales-quotes/${token}`;

/**
 * 수주 상세(플랫폼 관리자) — signstage-docs business/platform-order-partner-subcontract-review.md
 * 3장 흐름의 중심 화면. 견적 → 고객 수락(견적 링크 또는 관리자 기록) → 파트너 발주(미리보기로
 * 발주 금액·마진·파트너 자격 확인 후 발급) → 파트너 수락 시 행사 생성. 수주당 응답 대기·수락
 * 발주는 하나이고(D04), 거절·만료·취소된 뒤에는 다시 발주할 수 있다.
 */
export const AdminSalesOrderDetail: FC = () => {
  const { salesOrderId } = useParams<{ salesOrderId: string }>();
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_SALES_ORDER_MANAGE'));
  const canIssue = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_ORDER_ISSUE'));
  const canManageOffset = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_PAYMENT_APPROVE'));
  const canReplacePartner = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_ORDER_REPLACE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [order, setOrder] = useState<SalesOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAcceptOpen, setIsAcceptOpen] = useState(false);
  const [acceptedByName, setAcceptedByName] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationSummary[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [responseDueAt, setResponseDueAt] = useState(defaultResponseDueAt);
  const [preview, setPreview] = useState<PartnerOrderPreview | null>(null);
  const [cancellingPartnerOrder, setCancellingPartnerOrder] = useState<AdminPartnerOrderSummary | null>(null);
  const [partnerCancelReason, setPartnerCancelReason] = useState('');
  const [offsetTarget, setOffsetTarget] = useState<AdminPartnerOrderSummary | null>(null);
  const [offsetAmount, setOffsetAmount] = useState('');
  const [offsetReason, setOffsetReason] = useState('');
  const [offsetOccurredOn, setOffsetOccurredOn] = useState('');

  const basePath = `/platform-admin/sales-orders/${salesOrderId}`;

  const reload = useCallback(async () => {
    const response = await api.get(basePath);
    setOrder(response.data as SalesOrderDetail);
  }, [basePath]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
        if (canIssue) {
          const response = await api.get('/platform-admin/organizations?status=ACTIVE&size=200');
          if (!cancelled) setOrganizations((response.data as PageResponse<PlatformAdminOrganizationSummary>).content);
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '수주를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, canIssue, showSnackbar]);

  const run = async (action: () => Promise<void>, successMessage: string, failureMessage: string) => {
    setIsSubmitting(true);
    try {
      await action();
      showSnackbar(successMessage, 'success');
      await reload();
      return true;
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : failureMessage, 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordAcceptance = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptedByName.trim()) {
      showSnackbar('수락한 고객 담당자 이름을 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => { await api.post(`${basePath}/acceptance`, { acceptedByName: acceptedByName.trim() }); },
      '고객 수락을 기록했습니다.', '수락 기록에 실패했습니다.',
    );
    if (ok) setIsAcceptOpen(false);
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => { await api.post(`${basePath}/cancel`, { reason: cancelReason.trim() }); },
      '수주를 취소했습니다.', '수주 취소에 실패했습니다.',
    );
    if (ok) setIsCancelOpen(false);
  };

  const adjustmentValue = adjustmentAmount === '' || adjustmentAmount === '-' ? null : Number(adjustmentAmount);

  const handlePreview = async () => {
    if (!partnerId) {
      showSnackbar('발주할 파트너를 고르세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`${basePath}/partner-orders/preview`, {
        organizationId: Number(partnerId),
        adjustmentAmount: adjustmentValue,
      });
      setPreview(response.data as PartnerOrderPreview);
    } catch (err) {
      setPreview(null);
      showSnackbar(err instanceof Error ? err.message : '발주 금액 계산에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIssue = async () => {
    if (!partnerId || !responseDueAt) {
      showSnackbar('파트너와 응답 기한을 입력해주세요.', 'error');
      return;
    }
    if (adjustmentValue && !adjustmentReason.trim()) {
      showSnackbar('조정 사유를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post(`${basePath}/partner-orders`, {
          organizationId: Number(partnerId),
          responseDueAt,
          adjustmentAmount: adjustmentValue,
          adjustmentReason: blankToNull(adjustmentReason),
        });
      },
      '파트너에게 발주했습니다.', '발주에 실패했습니다.',
    );
    if (ok) {
      setPreview(null);
      setPartnerId('');
      setAdjustmentAmount('');
      setAdjustmentReason('');
    }
  };

  const handleCancelPartnerOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancellingPartnerOrder || !partnerCancelReason.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post(`/platform-admin/partner-orders/${cancellingPartnerOrder.id}/cancel`, {
          reason: partnerCancelReason.trim(),
        });
      },
      '발주를 취소했습니다.', '발주 취소에 실패했습니다.',
    );
    if (ok) setCancellingPartnerOrder(null);
  };

  const handleRegisterOffset = async (e: FormEvent) => {
    e.preventDefault();
    if (!offsetTarget) return;
    const amount = Number(offsetAmount || 0);
    if (!(amount > 0) || amount > offsetTarget.totalAmount) {
      showSnackbar('상계 금액은 0보다 크고 발주 금액 이하여야 합니다.', 'error');
      return;
    }
    if (!offsetReason.trim()) {
      showSnackbar('귀책 사유를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post('/platform-admin/partner-offsets', {
          partnerOrderId: offsetTarget.id,
          amount,
          reason: offsetReason.trim(),
          occurredOn: offsetOccurredOn || null,
        });
      },
      '귀책 상계를 등록했습니다. 다음 월 정산에서 지급액에서 뺍니다.', '상계 등록에 실패했습니다.',
    );
    if (ok) setOffsetTarget(null);
  };

  const handleCopyLink = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(quoteLinkOf(order.quoteAccessToken));
      showSnackbar('견적 링크를 복사했습니다.', 'success');
    } catch {
      showSnackbar('복사하지 못했습니다. 링크를 직접 선택해 복사해주세요.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }
  if (!order) {
    return <p className="py-16 text-center text-sm text-gray-500">수주를 찾을 수 없습니다.</p>;
  }

  const currency = order.currencyCode;
  const hasLivePartnerOrder = order.partnerOrders.some((po) => po.status === 'ISSUED' || po.status === 'ACCEPTED');
  const canIssueNow = canIssue && order.status === 'ACCEPTED' && !hasLivePartnerOrder;
  // 수락 후 취소(파트너 교체)된 발주의 행사 — 다음에 수락하는 파트너가 넘겨받는다.
  const carriedCeremonyId = hasLivePartnerOrder
    ? null
    : order.partnerOrders.find((po) => po.status === 'CANCELLED' && po.ceremonyId !== null)?.ceremonyId ?? null;
  const estimatedMargin = order.supplyAmount - order.estimatedPartnerAmount;

  return (
    <div className="max-w-5xl">
      <Link to="/admin/sales-orders" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-950">
        <ArrowLeft size={14} /> 수주 목록
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <FileText size={20} className="text-gray-400" />
            {order.title}
            <SalesOrderStatusBadge status={order.status} />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {order.customerName} · {formatSchedule(order.startsAt, order.endsAt)}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {order.status === 'QUOTED' && (
              <>
                <Button variant="secondary" to={`/admin/sales-orders/${order.id}/edit`}>
                  <Pencil size={14} /> 견적 수정
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAcceptedByName('');
                    setIsAcceptOpen(true);
                  }}
                >
                  <CheckCircle2 size={14} /> 고객 수락 기록
                </Button>
              </>
            )}
            {order.status !== 'CANCELLED' && (
              <Button
                variant="danger-outline"
                onClick={() => {
                  setCancelReason('');
                  setIsCancelOpen(true);
                }}
              >
                <Ban size={14} /> 수주 취소
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          <DetailRow label="고객" value={order.customerName} />
          <DetailRow label="일정" value={formatSchedule(order.startsAt, order.endsAt)} />
          <DetailRow label="권역·장소" value={`${REGION_LABEL[order.region]} · ${order.location ?? '장소 미정'}`} />
          <DetailRow label="패키지" value={order.billingPlanName} />
          <DetailRow label="수행 규모" value={`태블릿 ${order.tabletCount}대 · 현장 인력 ${order.onsiteStaffPersonDays}인·일`} />
          {formatScopeExtras(order) && <DetailRow label="추가 범위" value={formatScopeExtras(order)} />}
          <DetailRow label="견적 유효기간" value={order.quoteValidUntil} />
          {order.acceptedAt && (
            <DetailRow
              label="고객 수락"
              value={`${order.acceptedByName ?? '-'} · ${formatDateTime(order.acceptedAt)}${
                order.acceptanceChannel ? ` · ${ACCEPTANCE_CHANNEL_LABEL[order.acceptanceChannel]}` : ''
              }`}
            />
          )}
          {order.cancelledAt && (
            <DetailRow label="취소" value={`${formatDateTime(order.cancelledAt)} · ${order.cancellationReason ?? ''}`} />
          )}
          {order.memo && <DetailRow label="내부 메모" value={<span className="whitespace-pre-wrap">{order.memo}</span>} />}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-950 mb-2">고객 견적</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium pb-1">항목</th>
                <th className="text-right font-medium pb-1">수량</th>
                <th className="text-right font-medium pb-1">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.lines.map((line, index) => (
                <tr key={index}>
                  <td className="py-1.5 text-gray-950">{line.name}</td>
                  <td className="py-1.5 text-right text-gray-500 tabular-nums">{line.quantity}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(line.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {order.discountReason && <p className="mt-1 text-xs text-gray-400">할인 사유: {order.discountReason}</p>}
          <dl className="mt-3 border-t border-gray-200 pt-2 text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-gray-500">공급가</dt><dd className="tabular-nums">{formatMoney(order.supplyAmount, currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">부가세</dt><dd className="tabular-nums">{formatMoney(order.vatAmount, currency)}</dd></div>
            <div className="flex justify-between font-bold"><dt>합계</dt><dd className="tabular-nums">{formatMoney(order.totalAmount, currency)}</dd></div>
            <div className="flex justify-between text-xs text-gray-500 pt-1">
              <dt>예상 발주 금액(기본 단가표) · 예상 마진</dt>
              <dd className="tabular-nums">
                {formatMoney(order.estimatedPartnerAmount, currency)} · {formatMoney(estimatedMargin, currency)}
              </dd>
            </div>
          </dl>
          {order.status !== 'CANCELLED' && (
            <div className="mt-4 rounded-md bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">고객 견적 링크(로그인 없이 열람·수락)</p>
              <div className="flex items-center gap-2">
                <input readOnly value={quoteLinkOf(order.quoteAccessToken)} className={`${inputClass} bg-white text-xs`} />
                <Button variant="secondary" size="sm" onClick={handleCopyLink}>
                  <Copy size={12} /> 복사
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 mb-3 flex items-center gap-1.5">
          <Send size={14} /> 파트너 발주
        </h2>

        {order.partnerOrders.length === 0 ? (
          <p className="text-sm text-gray-400 mb-3">
            {order.status === 'QUOTED' ? '고객이 견적을 수락하면 발주할 수 있습니다.' : '발주 이력이 없습니다.'}
          </p>
        ) : (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="text-left font-medium pb-2">파트너</th>
                  <th className="text-right font-medium pb-2">발주 금액</th>
                  <th className="text-left font-medium pb-2 pl-4">응답 기한</th>
                  <th className="text-left font-medium pb-2">상태</th>
                  <th className="text-left font-medium pb-2">비고</th>
                  <th className="text-right font-medium pb-2">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.partnerOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2 text-gray-950">{po.organizationName}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(po.totalAmount, po.currencyCode)}</td>
                    <td className="py-2 pl-4 text-gray-500">{formatWallDateTime(po.responseDueAt)}</td>
                    <td className="py-2"><PartnerOrderStatusBadge status={po.status} /></td>
                    <td className="py-2 text-xs text-gray-500">
                      {po.status === 'ACCEPTED' && po.ceremonyId !== null ? (
                        <Link
                          to={`/admin/organizations/${po.organizationId}/ceremonies/${po.ceremonyId}/history`}
                          className="text-gray-950 hover:underline"
                        >
                          행사 #{po.ceremonyId}
                        </Link>
                      ) : (
                        po.rejectionReason ?? po.cancellationReason ?? (po.adjustmentReason ? `조정: ${po.adjustmentReason}` : '')
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {canIssue && po.status === 'ISSUED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPartnerCancelReason('');
                            setCancellingPartnerOrder(po);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={12} /> 발주 취소
                        </button>
                      )}
                      {canReplacePartner && po.status === 'ACCEPTED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPartnerCancelReason('');
                            setCancellingPartnerOrder(po);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50"
                        >
                          <XCircle size={12} /> 파트너 교체
                        </button>
                      )}
                      {canManageOffset && po.status === 'ACCEPTED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOffsetAmount('');
                            setOffsetReason('');
                            setOffsetOccurredOn('');
                            setOffsetTarget(po);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100"
                        >
                          귀책 상계
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canIssueNow && carriedCeremonyId !== null && (
          <p className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            파트너 교체 중입니다. 새 파트너가 발주를 수락하면 기존 행사 #{carriedCeremonyId}를 넘겨받습니다.
          </p>
        )}
        {canIssueNow && (
          <div className="border-t border-gray-100 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Field label="파트너">
                <select
                  value={partnerId}
                  onChange={(e) => {
                    setPartnerId(e.target.value);
                    setPreview(null);
                  }}
                  disabled={isSubmitting}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">선택</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>{organization.name}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="조정 금액(±)">
                  <FormattedNumberInput
                    value={adjustmentAmount}
                    onChange={(value) => {
                      setAdjustmentAmount(value);
                      setPreview(null);
                    }}
                    disabled={isSubmitting}
                    placeholder="0"
                    className={inputClass}
                  />
                </Field>
                <Field label="응답 기한(현지 시각)">
                  <input
                    type="datetime-local"
                    value={responseDueAt}
                    onChange={(e) => setResponseDueAt(e.target.value)}
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="조정 사유">
                <input
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="조정 금액이 있으면 필수"
                  className={inputClass}
                />
              </Field>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handlePreview} disabled={isSubmitting || !partnerId}>
                  발주 금액 계산
                </Button>
                <Button
                  size="sm"
                  onClick={handleIssue}
                  disabled={isSubmitting || !preview || !preview.partnerEligible || !preview.marginSufficient}
                >
                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  발주서 발급
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              {preview ? (
                <>
                  <PartnerOrderAmountBreakdown currencyCode={currency} {...preview} />
                  <dl className="mt-2 border-t border-gray-200 pt-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">고객 공급가</dt>
                      <dd className="tabular-nums">{formatMoney(preview.customerSupplyAmount, currency)}</dd>
                    </div>
                    <div className="flex justify-between font-bold">
                      <dt>마진</dt>
                      <dd className={`tabular-nums ${preview.marginSufficient ? 'text-emerald-700' : 'text-red-600'}`}>
                        {formatMoney(preview.marginAmount, currency)}
                      </dd>
                    </div>
                  </dl>
                  {!preview.partnerEligible && (
                    <p className="mt-2 text-xs text-red-600">
                      이 파트너는 발주 요건(사업자 정보·확인된 정산 계좌·약관 동의)을 채우지 않았습니다.
                    </p>
                  )}
                  {!preview.marginSufficient && (
                    <p className="mt-2 text-xs text-red-600">발주 금액이 최소 마진 기준을 넘습니다. 조정 금액을 낮추세요.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">파트너를 고르고 "발주 금액 계산"을 누르면 단가표로 계산한 금액과 마진을 보여줍니다.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <SalesOrderChangeSection order={order} canManage={canManage} onApplied={reload} />

      {order.status !== 'QUOTED' && <SalesOrderBillingSection salesOrderId={order.id} refreshKey={order} />}

      <Modal open={isAcceptOpen} onClose={() => setIsAcceptOpen(false)} title="고객 수락 기록" widthClassName="max-w-sm">
        <form onSubmit={handleRecordAcceptance} className="space-y-3">
          <p className="text-sm text-gray-600">전화·메일로 받은 수락을 대신 기록합니다.</p>
          <Field label="수락한 고객 담당자">
            <input
              value={acceptedByName}
              onChange={(e) => setAcceptedByName(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="기록 중..." saveLabel="수락 기록" onCancel={() => setIsAcceptOpen(false)} />
        </form>
      </Modal>

      <Modal open={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="수주 취소" widthClassName="max-w-sm">
        <form onSubmit={handleCancel} className="space-y-3">
          <p className="text-sm text-gray-600">응답 대기 중인 발주도 함께 취소합니다. 파트너가 수락한 발주가 있으면 취소할 수 없습니다.</p>
          <Field label="취소 사유">
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="수주 취소" onCancel={() => setIsCancelOpen(false)} />
        </form>
      </Modal>

      <Modal
        open={cancellingPartnerOrder !== null}
        onClose={() => setCancellingPartnerOrder(null)}
        title={cancellingPartnerOrder?.status === 'ACCEPTED' ? '파트너 교체(수락한 발주 취소)' : '발주 취소'}
        widthClassName="max-w-sm"
      >
        <form onSubmit={handleCancelPartnerOrder} className="space-y-3">
          {cancellingPartnerOrder?.status === 'ACCEPTED' ? (
            <p className="text-sm text-gray-600">
              수락된 {cancellingPartnerOrder.organizationName} 발주를 취소합니다. 행사는 그대로 남고, 다음에 발주를 수락하는 파트너가
              넘겨받습니다(서명자·문서 포함). 이전 파트너 담당자 배정과 진행 중인 범위 변경은 정리됩니다. 행사가 완료된 발주는 취소할 수
              없습니다.
            </p>
          ) : (
            <p className="text-sm text-gray-600">{cancellingPartnerOrder?.organizationName}에 보낸 응답 대기 발주를 취소합니다.</p>
          )}
          <Field label="취소 사유">
            <input
              value={partnerCancelReason}
              onChange={(e) => setPartnerCancelReason(e.target.value)}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="발주 취소" onCancel={() => setCancellingPartnerOrder(null)} />
        </form>
      </Modal>

      <Modal open={offsetTarget !== null} onClose={() => setOffsetTarget(null)} title="귀책 상계 등록" widthClassName="max-w-md">
        {offsetTarget && (
          <form onSubmit={handleRegisterOffset} className="space-y-3">
            <p className="text-sm text-gray-600">
              {offsetTarget.organizationName} · 발주 금액 {formatMoney(offsetTarget.totalAmount, offsetTarget.currencyCode)}.
              고객 환불 중 파트너 귀책분처럼 파트너에게 돌려받을 금액(공급가)을 등록합니다.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="상계 금액(공급가)">
                <FormattedNumberInput
                  value={offsetAmount}
                  onChange={setOffsetAmount}
                  min={0}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </Field>
              <Field label="발생일(비우면 오늘)">
                <input
                  type="date"
                  value={offsetOccurredOn}
                  onChange={(e) => setOffsetOccurredOn(e.target.value)}
                  disabled={isSubmitting}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="귀책 사유(파트너에게 보임)">
              <input
                value={offsetReason}
                onChange={(e) => setOffsetReason(e.target.value)}
                maxLength={500}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <p className="text-xs text-gray-400">
              다음 월 정산에서 이 파트너 지급액에서 빼고, 지급액을 넘으면 이월합니다. 원장에 상계(−)가 남습니다.
            </p>
            <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="상계 등록" onCancel={() => setOffsetTarget(null)} />
          </form>
        )}
      </Modal>
    </div>
  );
};
