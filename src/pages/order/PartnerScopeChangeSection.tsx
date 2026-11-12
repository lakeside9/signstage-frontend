import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CheckCircle2, GitCompare, MessageSquarePlus, XCircle } from 'lucide-react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatDateTime } from '../../utils/internationalization';
import { Field, FormActions } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import { SalesOrderChangeStatusBadge } from './components';
import { formatMoney, formatSchedule } from './constants';
import type { PartnerScopeChange, PartnerScopeChangeOverview } from '../../types';

interface Props {
  /** {@code /organizations/{orgId}/partner-orders/{id}} */
  basePath: string;
  canRespond: boolean;
  /** 수락했고 검수 전이면 범위 변경을 요청할 수 있다. */
  canRequest: boolean;
  /** 변경이 반영되면 발주 상세를 다시 불러온다. */
  onApplied: () => Promise<void>;
}

/**
 * 발주 범위 변경(파트너, D08) — 플랫폼이 제안한 변경(수량·일정·발주 금액)에 동의·거절하고, 현장에서 범위
 * 변경이 필요하면 플랫폼에 요청한다. 범위는 플랫폼이 고객과 정해 바꾼다. 고객 금액은 보이지 않는다(D14).
 */
export const PartnerScopeChangeSection: FC<Props> = ({ basePath, canRespond, canRequest, onApplied }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [overview, setOverview] = useState<PartnerScopeChangeOverview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<PartnerScopeChange | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PartnerScopeChange | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestContent, setRequestContent] = useState('');

  const load = useCallback(async () => {
    const response = await api.get(`${basePath}/scope-changes`);
    setOverview(response.data as PartnerScopeChangeOverview);
  }, [basePath]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '범위 변경을 불러오지 못했습니다.', 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, showSnackbar]);

  const submit = async (action: () => Promise<PartnerScopeChangeOverview>, successMessage: string, failureMessage: string) => {
    setIsSubmitting(true);
    try {
      const next = await action();
      setOverview(next);
      showSnackbar(successMessage, 'success');
      return next;
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : failureMessage, 'error');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!acceptTarget) return;
    const next = await submit(
      async () => (await api.post(`${basePath}/scope-changes/${acceptTarget.id}/accept`)).data as PartnerScopeChangeOverview,
      '범위 변경에 동의했습니다.',
      '동의에 실패했습니다.',
    );
    if (next) {
      setAcceptTarget(null);
      if (next.changes.some((change) => change.id === acceptTarget.id && change.status === 'APPLIED')) await onApplied();
    }
  };

  const handleReject = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectTarget || !rejectReason.trim()) {
      showSnackbar('거절 사유를 입력해주세요.', 'error');
      return;
    }
    const next = await submit(
      async () =>
        (await api.post(`${basePath}/scope-changes/${rejectTarget.id}/reject`, { reason: rejectReason.trim() })).data as PartnerScopeChangeOverview,
      '범위 변경을 거절했습니다.',
      '거절에 실패했습니다.',
    );
    if (next) setRejectTarget(null);
  };

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!requestContent.trim()) {
      showSnackbar('요청 내용을 입력해주세요.', 'error');
      return;
    }
    const next = await submit(
      async () => (await api.post(`${basePath}/scope-requests`, { content: requestContent.trim() })).data as PartnerScopeChangeOverview,
      '범위 변경을 요청했습니다. 플랫폼이 고객과 확인한 뒤 변경을 제안합니다.',
      '요청에 실패했습니다.',
    );
    if (next) setIsRequestOpen(false);
  };

  const changes = overview?.changes ?? [];
  const requests = overview?.requests ?? [];
  if (!canRequest && changes.length === 0 && requests.length === 0) return null;

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <GitCompare size={14} /> 범위 변경
        </h2>
        {canRespond && canRequest && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setRequestContent('');
              setIsRequestOpen(true);
            }}
          >
            <MessageSquarePlus size={12} /> 범위 변경 요청
          </Button>
        )}
      </div>

      {changes.length === 0 ? (
        <p className="text-sm text-gray-400">
          수량·일정이 바뀌어야 하면 범위 변경을 요청하세요. 고객 수락 없이 늘린 범위는 발주 금액에 반영되지 않습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {changes.map((change) => (
            <li key={change.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-950 flex items-center gap-2">
                    {change.reason} <SalesOrderChangeStatusBadge status={change.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">제안 {formatDateTime(change.proposedAt)}</p>
                </div>
                {canRespond && change.respondable && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger-outline"
                      onClick={() => {
                        setRejectReason('');
                        setRejectTarget(change);
                      }}
                    >
                      <XCircle size={12} /> 거절
                    </Button>
                    <Button size="sm" onClick={() => setAcceptTarget(change)}>
                      <CheckCircle2 size={12} /> 동의
                    </Button>
                  </div>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">발주 금액(공급가)</dt>
                  <dd className="tabular-nums">
                    {formatMoney(change.beforePartnerAmount, change.currencyCode)} → <b>{formatMoney(change.partnerAmount, change.currencyCode)}</b>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">태블릿·현장 인력</dt>
                  <dd>
                    {change.beforeTabletCount}대·{change.beforeOnsiteStaffPersonDays}인일 → {change.tabletCount}대·{change.onsiteStaffPersonDays}인일
                  </dd>
                </div>
                <div className="flex justify-between gap-2 sm:col-span-2">
                  <dt className="text-gray-500">일정·장소</dt>
                  <dd className="text-right">{formatSchedule(change.startsAt, change.endsAt)} · {change.location ?? '장소 미정'}</dd>
                </div>
                <div className="flex justify-between gap-2 sm:col-span-2">
                  <dt className="text-gray-500">추가 범위</dt>
                  <dd className="text-right">
                    {change.options.length === 0 ? '없음' : change.options.map((option) => `${option.name} ${option.quantity}`).join(', ')}
                  </dd>
                </div>
              </dl>
              {change.status === 'PROPOSED' && (
                <p className="mt-2 text-xs text-gray-500">
                  {change.partnerAccepted ? '동의했습니다. ' : ''}
                  {change.customerAccepted ? '고객이 수락했습니다.' : '고객 수락 대기 중입니다.'} 둘 다 끝나면 발주·행사에 반영됩니다.
                </p>
              )}
              {change.partnerRejectionReason && <p className="mt-1 text-xs text-red-600">거절 사유: {change.partnerRejectionReason}</p>}
              {change.appliedAt && <p className="mt-1 text-xs text-emerald-700">반영 {formatDateTime(change.appliedAt)}</p>}
              {change.cancellationReason && <p className="mt-1 text-xs text-gray-500">플랫폼 취소: {change.cancellationReason}</p>}
            </li>
          ))}
        </ul>
      )}

      {requests.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-1 text-xs font-medium text-gray-500">보낸 요청</p>
          <ul className="space-y-1 text-xs text-gray-600">
            {requests.map((request) => (
              <li key={request.id}>
                {formatDateTime(request.requestedAt)} · {request.content}
                <span className="text-gray-400">
                  {request.closedAt === null
                    ? ' — 확인 중'
                    : request.salesOrderChangeId
                      ? ' — 범위 변경으로 제안됨'
                      : ` — 처리: ${request.closingNote ?? ''}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={acceptTarget !== null} onClose={() => setAcceptTarget(null)} title="범위 변경 동의" widthClassName="max-w-sm">
        <p className="text-sm text-gray-700">
          발주 금액이 {formatMoney(acceptTarget?.partnerAmount, acceptTarget?.currencyCode)}(공급가)으로 바뀌고 바뀐 수량·일정으로 수행합니다.
          고객 수락까지 받으면 발주와 행사에 바로 반영됩니다.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAcceptTarget(null)} disabled={isSubmitting}>취소</Button>
          <Button size="sm" onClick={handleAccept} disabled={isSubmitting}>
            <CheckCircle2 size={12} /> 동의
          </Button>
        </div>
      </Modal>

      <Modal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title="범위 변경 거절" widthClassName="max-w-sm">
        <form onSubmit={handleReject} className="space-y-3">
          <Field label="거절 사유">
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} maxLength={500} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="거절" onCancel={() => setRejectTarget(null)} />
        </form>
      </Modal>

      <Modal open={isRequestOpen} onClose={() => setIsRequestOpen(false)} title="범위 변경 요청" widthClassName="max-w-sm">
        <form onSubmit={handleRequest} className="space-y-3">
          <p className="text-sm text-gray-600">
            필요한 변경(예: 태블릿 2대 추가, 시작 시각 변경)과 이유를 적어주세요. 플랫폼이 고객과 확인해 변경을 제안하면 동의 여부를 고를 수 있습니다.
          </p>
          <Field label="요청 내용">
            <textarea
              value={requestContent}
              onChange={(e) => setRequestContent(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
              className={inputClass}
            />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="보내는 중..." saveLabel="요청" onCancel={() => setIsRequestOpen(false)} />
        </form>
      </Modal>
    </section>
  );
};
