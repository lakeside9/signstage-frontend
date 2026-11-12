import { useCallback, useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { GitCompare, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/Button';
import { EventDateTimeInput } from '../../components/EventDateTimeInput';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { Modal } from '../../components/Modal';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatDateTime } from '../../utils/internationalization';
import { Field, FormActions } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import { SalesOrderChangeStatusBadge, ScopeExtrasFields } from './components';
import { formatMoney, formatSchedule, formatScopeExtras, isLodgingDraftValid, toScopeExtras, toScopeExtrasDraft } from './constants';
import type { ScopeExtrasDraft } from './constants';
import type {
  AdminSalesOrderChange,
  AdminSalesOrderChangeOverview,
  AdminSalesOrderDetail,
  ScopeChangeRequestSummary,
  UnitProductSummary,
} from '../../types';

interface OptionDraft {
  unitProductId: string;
  quantity: string;
}

interface ChangeDraft {
  reason: string;
  options: OptionDraft[];
  extras: ScopeExtrasDraft;
  discountAmount: string;
  discountReason: string;
  location: string;
  startsAt: string;
  endsAt: string;
}

const toDraft = (order: AdminSalesOrderDetail): ChangeDraft => {
  const discountLine = order.lines.find((line) => line.lineType === 'DISCOUNT');
  return {
    reason: '',
    options: order.lines
      .filter((line) => line.lineType === 'UNIT_PRODUCT' && line.unitProductId !== null)
      .map((line) => ({ unitProductId: String(line.unitProductId), quantity: String(line.quantity) })),
    extras: toScopeExtrasDraft(order),
    discountAmount: discountLine ? String(Math.abs(discountLine.amount)) : '',
    discountReason: order.discountReason ?? '',
    location: order.location ?? '',
    startsAt: order.startsAt?.slice(0, 16) ?? '',
    endsAt: order.endsAt?.slice(0, 16) ?? '',
  };
};

const blankToNull = (value: string) => (value.trim() ? value.trim() : null);

interface Props {
  order: AdminSalesOrderDetail;
  canManage: boolean;
  /** 변경이 반영되면 수주 상세를 다시 불러온다. */
  onApplied: () => Promise<void>;
}

/**
 * 수주 범위 변경(D08) — 수락된 수주의 옵션 수량·영업 할인·장소·일정을 바꾸는 변경을 제안하고,
 * 고객 수락을 기록한다. 수락된 발주가 있으면 파트너 동의까지 받아야 반영된다. 파트너가 보낸 범위 변경
 * 요청도 여기서 보고 닫는다.
 */
export const SalesOrderChangeSection: FC<Props> = ({ order, canManage, onApplied }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const basePath = `/platform-admin/sales-orders/${order.id}`;

  const [overview, setOverview] = useState<AdminSalesOrderChangeOverview | null>(null);
  const [unitProducts, setUnitProducts] = useState<UnitProductSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<ChangeDraft | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<AdminSalesOrderChange | null>(null);
  const [acceptedByName, setAcceptedByName] = useState('');
  const [cancelTarget, setCancelTarget] = useState<AdminSalesOrderChange | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [closeTarget, setCloseTarget] = useState<ScopeChangeRequestSummary | null>(null);
  const [closeNote, setCloseNote] = useState('');

  const load = useCallback(async () => {
    const response = await api.get(`${basePath}/changes`);
    setOverview(response.data as AdminSalesOrderChangeOverview);
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
  }, [load, showSnackbar, order]);

  const openPropose = async () => {
    setDraft(toDraft(order));
    if (unitProducts.length === 0) {
      try {
        const response = await api.get('/unit-products?salesChannel=PLATFORM_ORDER');
        setUnitProducts(response.data as UnitProductSummary[]);
      } catch (err) {
        showSnackbar(err instanceof Error ? err.message : '단위 상품을 불러오지 못했습니다.', 'error');
      }
    }
  };

  const run = async (action: () => Promise<boolean>, successMessage: string, failureMessage: string) => {
    setIsSubmitting(true);
    try {
      const applied = await action();
      showSnackbar(successMessage, 'success');
      await load();
      if (applied) await onApplied();
      return true;
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : failureMessage, 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePropose = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.reason.trim()) {
      showSnackbar('변경 사유를 입력해주세요.', 'error');
      return;
    }
    if (Number(draft.discountAmount) > 0 && !draft.discountReason.trim()) {
      showSnackbar('영업 할인이 있으면 할인 사유가 필요합니다.', 'error');
      return;
    }
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) {
      showSnackbar('종료 일시는 시작 일시보다 빠를 수 없습니다.', 'error');
      return;
    }
    if (!isLodgingDraftValid(draft.extras)) {
      showSnackbar('숙박은 박수와 인원을 함께 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post(`${basePath}/changes`, {
          reason: draft.reason.trim(),
          options: draft.options
            .filter((option) => option.unitProductId && Number(option.quantity) > 0)
            .map((option) => ({ unitProductId: Number(option.unitProductId), quantity: Number(option.quantity) })),
          discountAmount: draft.discountAmount === '' ? null : Number(draft.discountAmount),
          discountReason: blankToNull(draft.discountReason),
          location: blankToNull(draft.location),
          startsAt: draft.startsAt || null,
          endsAt: draft.endsAt || null,
          ...toScopeExtras(draft.extras),
        });
        return false;
      },
      '범위 변경을 제안했습니다. 고객 수락을 기록하고 파트너 동의를 받으면 반영됩니다.',
      '범위 변경 제안에 실패했습니다.',
    );
    if (ok) setDraft(null);
  };

  const handleRecordAcceptance = async (e: FormEvent) => {
    e.preventDefault();
    if (!acceptTarget || !acceptedByName.trim()) {
      showSnackbar('수락한 고객 담당자를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        const response = await api.post(`${basePath}/changes/${acceptTarget.id}/customer-acceptance`, {
          acceptedByName: acceptedByName.trim(),
        });
        return (response.data as AdminSalesOrderChange).status === 'APPLIED';
      },
      '고객 수락을 기록했습니다.',
      '고객 수락 기록에 실패했습니다.',
    );
    if (ok) setAcceptTarget(null);
  };

  const handleCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !cancelReason.trim()) {
      showSnackbar('취소 사유를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post(`${basePath}/changes/${cancelTarget.id}/cancel`, { reason: cancelReason.trim() });
        return false;
      },
      '범위 변경을 취소했습니다.',
      '범위 변경 취소에 실패했습니다.',
    );
    if (ok) setCancelTarget(null);
  };

  const handleCloseRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!closeTarget || !closeNote.trim()) {
      showSnackbar('처리 메모를 입력해주세요.', 'error');
      return;
    }
    const ok = await run(
      async () => {
        await api.post(`${basePath}/scope-requests/${closeTarget.id}/close`, { note: closeNote.trim() });
        return false;
      },
      '요청을 닫았습니다.',
      '요청 처리에 실패했습니다.',
    );
    if (ok) setCloseTarget(null);
  };

  const updateOption = (index: number, patch: Partial<OptionDraft>) =>
    setDraft((prev) => prev && { ...prev, options: prev.options.map((option, i) => (i === index ? { ...option, ...patch } : option)) });

  const changes = overview?.changes ?? [];
  const requests = overview?.requests ?? [];
  const openRequests = requests.filter((request) => request.closedAt === null);
  const hasProposed = changes.some((change) => change.status === 'PROPOSED');
  const canPropose = canManage && order.status === 'ACCEPTED' && !hasProposed;

  if (order.status !== 'ACCEPTED' && changes.length === 0) return null;

  return (
    <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
          <GitCompare size={14} /> 범위 변경
        </h2>
        {canPropose && (
          <Button size="sm" variant="secondary" onClick={openPropose}>
            <Plus size={12} /> 범위 변경 제안
          </Button>
        )}
      </div>

      {openRequests.length > 0 && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-800">파트너 범위 변경 요청 {openRequests.length}건</p>
          {openRequests.map((request) => (
            <div key={request.id} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="text-gray-950">{request.content}</p>
                <p className="text-xs text-gray-500">{request.organizationName} · {formatDateTime(request.requestedAt)}</p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setCloseNote('');
                    setCloseTarget(request);
                  }}
                  className="shrink-0 text-xs text-gray-600 hover:underline"
                >
                  변경 없이 닫기
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-amber-700">범위 변경을 제안하면 열린 요청은 함께 닫힙니다.</p>
        </div>
      )}

      {changes.length === 0 ? (
        <p className="text-sm text-gray-400">
          고객이 수량·옵션·일정을 바꾸면 여기서 변경을 제안합니다. 고객 수락과 파트너 동의(수락된 발주가 있을 때)를 받으면 수주·발주·행사에 반영됩니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {changes.map((change) => (
            <li key={change.id} className="rounded-md border border-gray-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-950 flex items-center gap-2">
                    #{change.id} {change.reason} <SalesOrderChangeStatusBadge status={change.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">제안 {formatDateTime(change.proposedAt)}</p>
                </div>
                {canManage && change.status === 'PROPOSED' && (
                  <div className="flex gap-2">
                    {!change.customerAcceptedAt && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAcceptedByName('');
                          setAcceptTarget(change);
                        }}
                      >
                        고객 수락 기록
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger-outline"
                      onClick={() => {
                        setCancelReason('');
                        setCancelTarget(change);
                      }}
                    >
                      취소
                    </Button>
                  </div>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">고객 공급가</dt>
                  <dd className="tabular-nums">
                    {formatMoney(change.beforeSupplyAmount, change.currencyCode)} → <b>{formatMoney(change.supplyAmount, change.currencyCode)}</b>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">발주 금액</dt>
                  <dd className="tabular-nums">
                    {change.partnerAmount === null
                      ? `수락된 발주 없음 (예상 ${formatMoney(change.estimatedPartnerAmount, change.currencyCode)})`
                      : <>{formatMoney(change.beforePartnerAmount, change.currencyCode)} → <b>{formatMoney(change.partnerAmount, change.currencyCode)}</b></>}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">태블릿·현장 인력</dt>
                  <dd>
                    {change.beforeTabletCount}대·{change.beforeOnsiteStaffPersonDays}인일 → {change.tabletCount}대·{change.onsiteStaffPersonDays}인일
                  </dd>
                </div>
                {(formatScopeExtras(change.beforeExtras) || formatScopeExtras(change.extras)) && (
                  <div className="flex justify-between gap-2 sm:col-span-2">
                    <dt className="text-gray-500">예비·리허설·숙박</dt>
                    <dd className="text-right">
                      {formatScopeExtras(change.beforeExtras) ?? '없음'} → {formatScopeExtras(change.extras) ?? '없음'}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">일정·장소</dt>
                  <dd className="text-right">{formatSchedule(change.startsAt, change.endsAt)} · {change.location ?? '장소 미정'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">고객 수락</dt>
                  <dd>{change.customerAcceptedAt ? `${change.customerAcceptedByName} · ${formatDateTime(change.customerAcceptedAt)}` : '대기'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">파트너 동의</dt>
                  <dd>
                    {!change.needsPartnerConsent
                      ? '필요 없음'
                      : change.partnerRejectionReason
                        ? `거절: ${change.partnerRejectionReason}`
                        : change.partnerAccepted
                          ? `${change.partnerOrganizationName} 동의 · ${change.partnerRespondedAt ? formatDateTime(change.partnerRespondedAt) : ''}`
                          : `${change.partnerOrganizationName} 대기`}
                  </dd>
                </div>
              </dl>
              {change.lines.some((line) => line.lineType === 'UNIT_PRODUCT') && (
                <p className="mt-2 text-xs text-gray-500">
                  옵션: {change.lines.filter((line) => line.lineType === 'UNIT_PRODUCT').map((line) => `${line.name} ${line.quantity}`).join(', ')}
                </p>
              )}
              {change.appliedAt && <p className="mt-1 text-xs text-emerald-700">반영 {formatDateTime(change.appliedAt)}</p>}
              {change.cancellationReason && <p className="mt-1 text-xs text-gray-500">취소 사유: {change.cancellationReason}</p>}
            </li>
          ))}
        </ul>
      )}

      {requests.some((request) => request.closedAt !== null) && (
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">처리한 파트너 요청</summary>
          <ul className="mt-2 space-y-1">
            {requests.filter((request) => request.closedAt !== null).map((request) => (
              <li key={request.id}>
                {request.content} — {request.organizationName}
                {request.salesOrderChangeId ? ` → 변경 #${request.salesOrderChangeId}` : ` · ${request.closingNote ?? ''}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title="범위 변경 제안" widthClassName="max-w-2xl">
        {draft && (
          <form onSubmit={handlePropose} className="space-y-3">
            <p className="text-sm text-gray-600">
              변경 후 범위 전체를 입력합니다. 플랜·권역은 바꿀 수 없습니다. 고객 금액은 오늘 가격표로, 발주 금액은 발주 단가로 다시 계산합니다.
            </p>
            <Field label="변경 사유">
              <input
                value={draft.reason}
                onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                maxLength={500}
                disabled={isSubmitting}
                placeholder="예: 고객 요청으로 태블릿 2대 추가"
                className={inputClass}
              />
            </Field>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">추가 옵션</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDraft({ ...draft, options: [...draft.options, { unitProductId: '', quantity: '1' }] })}
                  disabled={isSubmitting}
                >
                  <Plus size={12} /> 옵션 추가
                </Button>
              </div>
              {draft.options.length === 0 ? (
                <p className="text-xs text-gray-400">옵션 없음(플랜 포함 범위만)</p>
              ) : (
                <ul className="space-y-2">
                  {draft.options.map((option, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <select
                        value={option.unitProductId}
                        onChange={(e) => updateOption(index, { unitProductId: e.target.value })}
                        disabled={isSubmitting}
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
                          disabled={isSubmitting}
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })}
                        disabled={isSubmitting}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="영업 할인(공급가)">
                <FormattedNumberInput
                  value={draft.discountAmount}
                  onChange={(value) => setDraft({ ...draft, discountAmount: value })}
                  min={0}
                  disabled={isSubmitting}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <Field label="할인 사유">
                <input
                  value={draft.discountReason}
                  onChange={(e) => setDraft({ ...draft, discountReason: e.target.value })}
                  disabled={isSubmitting}
                  placeholder="할인이 있으면 필수"
                  className={inputClass}
                />
              </Field>
              <Field label="시작">
                <EventDateTimeInput value={draft.startsAt} onChange={(value) => setDraft({ ...draft, startsAt: value })} disabled={isSubmitting} />
              </Field>
              <Field label="종료">
                <EventDateTimeInput value={draft.endsAt} onChange={(value) => setDraft({ ...draft, endsAt: value })} disabled={isSubmitting} />
              </Field>
            </div>
            <Field label="장소">
              <input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                maxLength={500}
                disabled={isSubmitting}
                className={inputClass}
              />
            </Field>
            <ScopeExtrasFields value={draft.extras} onChange={(next) => setDraft({ ...draft, extras: next })} disabled={isSubmitting} />
            <FormActions isSaving={isSubmitting} savingLabel="계산 중..." saveLabel="변경 제안" onCancel={() => setDraft(null)} />
          </form>
        )}
      </Modal>

      <Modal open={acceptTarget !== null} onClose={() => setAcceptTarget(null)} title="범위 변경 고객 수락 기록" widthClassName="max-w-sm">
        <form onSubmit={handleRecordAcceptance} className="space-y-3">
          <p className="text-sm text-gray-600">
            고객 금액 {formatMoney(acceptTarget?.totalAmount, acceptTarget?.currencyCode)}(부가세 포함)으로 바뀌는 변경에 대한 고객 수락을 기록합니다.
            {acceptTarget?.needsPartnerConsent && !acceptTarget.partnerAccepted && ' 파트너가 동의하면 반영됩니다.'}
          </p>
          <Field label="수락한 고객 담당자">
            <input value={acceptedByName} onChange={(e) => setAcceptedByName(e.target.value)} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="기록 중..." saveLabel="수락 기록" onCancel={() => setAcceptTarget(null)} />
        </form>
      </Modal>

      <Modal open={cancelTarget !== null} onClose={() => setCancelTarget(null)} title="범위 변경 취소" widthClassName="max-w-sm">
        <form onSubmit={handleCancel} className="space-y-3">
          <Field label="취소 사유">
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="변경 취소" onCancel={() => setCancelTarget(null)} />
        </form>
      </Modal>

      <Modal open={closeTarget !== null} onClose={() => setCloseTarget(null)} title="범위 변경 요청 닫기" widthClassName="max-w-sm">
        <form onSubmit={handleCloseRequest} className="space-y-3">
          <p className="text-sm text-gray-600">{closeTarget?.content}</p>
          <Field label="처리 메모(파트너에게 보임)">
            <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} maxLength={500} disabled={isSubmitting} className={inputClass} />
          </Field>
          <FormActions isSaving={isSubmitting} savingLabel="처리 중..." saveLabel="닫기" onCancel={() => setCloseTarget(null)} />
        </form>
      </Modal>
    </section>
  );
};
