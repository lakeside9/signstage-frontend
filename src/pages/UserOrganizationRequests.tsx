import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Building2, Clock, Loader2, NotebookPen, Plus, X } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationCreationRequestStatus, OrganizationCreationRequestSummary, OrganizationSummary } from '../types';

const STATUS_BADGE_CLASS: Record<OrganizationCreationRequestStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_LABEL: Record<OrganizationCreationRequestStatus, string> = {
  PENDING: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
  CANCELLED: '취소됨',
};

/**
 * 일반 사용자의 "조직 요청" 화면(`/org/organization-requests`, 사이드바 메뉴) — 조직 생성 요청
 * 제출과 요청 이력을 한 화면에서 다룬다. "조직 관리"(`UserOrganizationList`,
 * `/org/organizations`)가 "내가 속한 조직"을 보여주는 것과 역할이 분리돼 있다 — URL도
 * `/organizations` 하위가 아닌 별개 경로로 둬서 사이드바 활성 표시가 서로 겹치지 않는다.
 *
 * PENDING 요청이 있으면 새로 제출할 수 없으므로(동시 PENDING 1건 제한, 3.4절) 그 동안은 제출
 * 버튼을 비활성화한다. 이미 어느 조직에든 속해 있어도 마찬가지로 비활성화한다 — 1인 1조직
 * 제한(2026-08-16 결정, `OrganizationCreationRequestService#submit`이 서버에서 강제)을 화면에서
 * 미리 걸러내는 것으로, `GET /api/organizations`로 내 조직 목록이 비어있는지 확인한다.
 * 재신청은 최초 요청을 포함해 최대 5회까지만 허용되고(승인 시 리셋, 7.2절) 이 제한은 서버가
 * 강제한다 — 이 화면은 현재까지의 시도 내역을 그대로 보여줄 뿐 별도로 카운트를 계산하지 않는다
 * (signstage-docs business/organization-creation-approval-review.md).
 */
export const UserOrganizationRequests: FC = () => {
  const [requests, setRequests] = useState<OrganizationCreationRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchRequests = async () => {
    const response = await api.get('/organizations/requests');
    return response.data as OrganizationCreationRequestSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchRequests();
        if (!cancelled) {
          setRequests(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '요청 내역을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1인 1조직 제한(2026-08-16 결정) 때문에 이미 속한 조직이 있으면 제출 버튼을 비활성화해야 한다
  // — 실패해도 화면을 막지 않는다(버튼이 계속 활성 상태로 남을 뿐, 어차피 제출 시점에 서버가 막는다).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/organizations');
        if (!cancelled) {
          setOrganizations(response.data as OrganizationSummary[]);
        }
      } catch {
        // 위 주석 참고 — 조용히 무시한다.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasPending = requests.some((request) => request.status === 'PENDING');
  const hasAnyOrganization = organizations.length > 0;
  const canSubmitRequest = !hasPending && !hasAnyOrganization;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!organizationName) {
      showSnackbar('조직 이름을 입력해주세요.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/organizations/requests', { organizationName, note: note || undefined });
      showSnackbar('조직 생성을 요청했습니다. 관리자 승인을 기다려주세요.', 'success');
      setOrganizationName('');
      setNote('');
      setIsFormOpen(false);
      setRequests(await fetchRequests());
    } catch (err) {
      const message = err instanceof Error ? err.message : '조직 생성 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (requestId: number) => {
    setCancelingId(requestId);
    try {
      await api.delete(`/organizations/requests/${requestId}`);
      showSnackbar('요청을 취소했습니다.', 'success');
      setRequests(await fetchRequests());
    } catch (err) {
      const message = err instanceof Error ? err.message : '요청 취소에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">조직 요청</h1>
        <p className="mt-1 text-sm text-gray-500">
          새 조직 생성을 요청하고 진행 상태를 확인합니다. 승인되면 이 계정이 새 조직의 OWNER가 됩니다.
        </p>
      </div>

      <div className="mb-6">
        {hasPending ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            현재 승인 대기 중인 요청이 있습니다. 새 요청은 그 요청이 승인/반려되거나 취소된 뒤에 제출할 수
            있습니다.
          </div>
        ) : isFormOpen && canSubmitRequest ? (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">조직 이름</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <Building2 size={18} />
                </span>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
                  placeholder="예: 이폼웍스"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">메모 (선택)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400">
                  <NotebookPen size={18} />
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50 resize-none"
                  placeholder="관리자가 참고할 내용이 있다면 적어주세요."
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
              >
                {isSubmitting ? '제출 중...' : '요청 제출'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button
              onClick={() => setIsFormOpen(true)}
              disabled={hasAnyOrganization}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-950"
            >
              <Plus size={16} />
              새 조직 생성 요청
            </button>
            {hasAnyOrganization && (
              <p className="mt-2 text-xs text-gray-400">
                이미 소속된 조직이 있어 새로 요청할 수 없습니다. 한 사용자는 하나의 조직에만 속할 수
                있습니다.
              </p>
            )}
          </div>
        )}
      </div>

      <h2 className="text-sm font-bold text-gray-950 mb-3">요청 이력</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">아직 제출한 조직 생성 요청이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {requests.map((request) => (
              <li key={request.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-950 truncate">{request.organizationName}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(request.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE_CLASS[request.status]}`}
                  >
                    {STATUS_LABEL[request.status]}
                  </span>
                  {request.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      disabled={cancelingId === request.id}
                      className="shrink-0 flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                    >
                      <X size={12} />
                      취소
                    </button>
                  )}
                </div>
                {request.note && <p className="mt-1.5 text-xs text-gray-500">메모: {request.note}</p>}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <p className="mt-1.5 text-xs text-red-600">반려 사유: {request.rejectionReason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
