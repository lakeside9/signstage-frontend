import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Loader2, Plus, X } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { OrganizationCreationRequestStatus, OrganizationCreationRequestSummary } from '../types';

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
 * 내가 제출한 조직 생성 요청 내역이다 — signstage-docs
 * business/organization-creation-approval-review.md 3.4절. PENDING 요청은 취소할 수 있다.
 * 재신청은 최초 요청을 포함해 최대 5회까지만 허용되고(승인 시 리셋, 7.2절) 이 제한은 서버가
 * 강제한다 — 이 화면은 현재까지의 시도 내역을 그대로 보여줄 뿐 별도로 카운트를 계산하지 않는다.
 */
export const OrgOrganizationRequestList: FC = () => {
  const [requests, setRequests] = useState<OrganizationCreationRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

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

  const hasPending = requests.some((request) => request.status === 'PENDING');

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
      <Link
        to="/org/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        조직 관리로
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950">조직 생성 요청 내역</h1>
          <p className="mt-1 text-sm text-gray-500">내가 제출한 조직 생성 요청입니다.</p>
        </div>
        {!hasPending && (
          <Link
            to="/org/organizations/requests/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            새 요청
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-500">
            아직 제출한 조직 생성 요청이 없습니다. 위 "새 요청"으로 조직 생성을 요청해주세요.
          </p>
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
