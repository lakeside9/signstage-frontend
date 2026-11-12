import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Inbox, Loader2, XCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { DetailRow, Field, FormActions } from './billingCatalog/components';
import { inputClass } from './billingCatalog/constants';
import { PartnerOrderAmountBreakdown, PartnerOrderStatusBadge } from './order/components';
import { REGION_LABEL, formatSchedule, formatWallDateTime } from './order/constants';
import type { PartnerOrderDetail } from '../types';

/**
 * 발주 상세(파트너) — 수행 범위·일정·고객 담당자와 발주 금액 내역을 보고 수락·거절한다
 * (signstage-docs business/platform-order-partner-subcontract-review.md D03·D14). 고객 계약금액은
 * 보이지 않는다. 수락하면 이 조직 소유의 플랫폼 수주 행사가 만들어지고 플랜이 확정된 상태로
 * 시작하며, 수락한 사람이 담당자로 배정된다.
 */
export const UserPartnerOrderDetail: FC = () => {
  const { organizationId, partnerOrderId } = useParams<{ organizationId: string; partnerOrderId: string }>();
  const navigate = useNavigate();
  const canRespond = usePermissionStore((state) => state.hasPermission('ACTION_PARTNER_ORDER_RESPOND'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [order, setOrder] = useState<PartnerOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcceptOpen, setIsAcceptOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const basePath = `/organizations/${organizationId}/partner-orders/${partnerOrderId}`;

  const load = useCallback(async () => {
    const response = await api.get(basePath);
    setOrder(response.data as PartnerOrderDetail);
  }, [basePath]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '발주를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, showSnackbar]);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const response = await api.post(`${basePath}/accept`);
      const accepted = response.data as PartnerOrderDetail;
      showSnackbar('발주를 수락했습니다. 행사가 만들어졌습니다.', 'success');
      setIsAcceptOpen(false);
      if (accepted.summary.ceremonyId !== null) {
        navigate(`/ceremonies/${organizationId}/${accepted.summary.ceremonyId}`);
      } else {
        setOrder(accepted);
      }
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '수락에 실패했습니다.', 'error');
      await load().catch(() => undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      showSnackbar('거절 사유를 입력해주세요.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`${basePath}/reject`, { reason: rejectReason.trim() });
      setOrder(response.data as PartnerOrderDetail);
      setIsRejectOpen(false);
      showSnackbar('발주를 거절했습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '거절에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
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
    return <p className="py-16 text-center text-sm text-gray-500">발주를 찾을 수 없습니다.</p>;
  }

  const { summary } = order;
  const isPending = summary.status === 'ISSUED';

  return (
    <div className="max-w-4xl">
      <Link to={`/partner-orders/${organizationId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-950">
        <ArrowLeft size={14} /> 발주함
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <Inbox size={20} className="text-gray-400" />
            {summary.title}
            <PartnerOrderStatusBadge status={summary.status} />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            응답 기한 {formatWallDateTime(summary.responseDueAt)} · 발주일 {formatDateTime(summary.issuedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {summary.ceremonyId !== null && (
            <Button to={`/ceremonies/${organizationId}/${summary.ceremonyId}`}>행사로 이동</Button>
          )}
          {canRespond && isPending && (
            <>
              <Button variant="danger-outline" onClick={() => { setRejectReason(''); setIsRejectOpen(true); }}>
                <XCircle size={14} /> 거절
              </Button>
              <Button onClick={() => setIsAcceptOpen(true)}>
                <CheckCircle2 size={14} /> 수락
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          <DetailRow label="일정" value={formatSchedule(summary.startsAt, summary.endsAt)} />
          <DetailRow label="권역·장소" value={`${REGION_LABEL[summary.region]} · ${summary.location ?? '장소 미정'}`} />
          <DetailRow label="패키지" value={order.billingPlanName} />
          <DetailRow
            label="추가 범위"
            value={order.options.length === 0 ? '없음' : order.options.map((option) => `${option.name} ${option.quantity}`).join(', ')}
          />
          <DetailRow label="고객" value={order.customerName} />
          <DetailRow
            label="고객 담당자"
            value={[order.customerContactName, order.customerContactPhone, order.customerContactEmail].filter(Boolean).join(' · ') || '-'}
          />
          {order.respondedAt && <DetailRow label="응답일" value={formatDateTime(order.respondedAt)} />}
          {order.rejectionReason && <DetailRow label="거절 사유" value={order.rejectionReason} />}
        </section>
        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-bold text-gray-950 mb-2">발주 금액</h2>
          <PartnerOrderAmountBreakdown
            currencyCode={summary.currencyCode}
            baseFee={order.baseFee}
            tabletCount={order.tabletCount}
            tabletUnitRate={order.tabletUnitRate}
            onsiteStaffPersonDays={order.onsiteStaffPersonDays}
            onsiteStaffDayRate={order.onsiteStaffDayRate}
            regionSurcharge={order.regionSurcharge}
            adjustmentAmount={order.adjustmentAmount}
            adjustmentReason={order.adjustmentReason}
            totalAmount={summary.totalAmount}
          />
          <p className="mt-2 text-xs text-gray-400">부가세 별도. 지급은 행사 후 검수 승인 기준으로 합니다.</p>
        </section>
      </div>

      <Modal open={isAcceptOpen} onClose={() => setIsAcceptOpen(false)} title="발주 수락" widthClassName="max-w-sm">
        <p className="text-sm text-gray-700">
          수락하면 이 행사를 수행할 의무가 생기고, 행사가 바로 만들어집니다. 일정·장소·범위는 플랫폼만 바꿀 수 있습니다.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setIsAcceptOpen(false)} disabled={isSubmitting}>취소</Button>
          <Button size="sm" onClick={handleAccept} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            수락
          </Button>
        </div>
      </Modal>

      <Modal open={isRejectOpen} onClose={() => setIsRejectOpen(false)} title="발주 거절" widthClassName="max-w-sm">
        <form onSubmit={handleReject} className="space-y-3">
          <Field label="거절 사유">
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="거절" onCancel={() => setIsRejectOpen(false)} />
        </form>
      </Modal>
    </div>
  );
};
