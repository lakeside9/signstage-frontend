import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Loader2, Percent } from 'lucide-react';
import { ListContainer } from './ListContainer';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type { CeremonyStatus, CeremonySummary, DiscountType, PageResponse } from '../types';

const PAGE_SIZE = 10;

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const STATUS_OPTIONS: Array<{ value: CeremonyStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '준비 중(플랜 미확정)' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
];

const STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '준비 중',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

const STATUS_BADGE_CLASS: Record<CeremonyStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatCurrency(discountValue);

interface DiscountDraft {
  discountType: DiscountType;
  discountValue: number;
}

const EMPTY_DRAFT: DiscountDraft = { discountType: 'PERCENT', discountValue: 0 };

interface PanelProps {
  organizationId: string;
  canManage: boolean;
  showSnackbar: (message: string, variant: 'success' | 'error') => void;
}

/**
 * 행사(Ceremony) 건별 재량 할인 관리 패널 — signstage-docs
 * business/organization-event-discount-pricing-review.md 4.2/4.4절 참고. 품목 할인과 별개로
 * 이 행사 건에만 매기는 추가 할인이다. `AdminOrganizationDetail.tsx`가 조직 상세 화면 하단에
 * 붙여 쓴다(같은 위치의 {@link OrganizationDiscountPanel}과 짝을 이룬다 — 저쪽은 "조직×품목"
 * 축, 이쪽은 "행사 건" 축).
 *
 * 목록은 `GET /platform-admin/organizations/{organizationId}/ceremonies`(조직 멤버십 불필요,
 * 조회 전용이라 등급 검사 없음)로 가져오고, 설정은 `PUT .../ceremonies/{id}/final-discount`
 * (PLATFORM_OPS 이상 전용)를 쓴다. 백엔드가 플랜이 확정된(IN_PROGRESS) 행사에만 허용하므로
 * (DRAFT/COMPLETED는 거부), DRAFT/COMPLETED 행에는 설정 버튼을 아예 숨긴다 — 눌러서 거부
 * 응답을 받게 하는 대신 애초에 안 되는 이유를 행 옆에 짧게 적어둔다.
 */
export const CeremonyFinalDiscountPanel: FC<PanelProps> = ({ organizationId, canManage, showSnackbar }) => {
  const [statusFilter, setStatusFilter] = useState<CeremonyStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<CeremonySummary> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<DiscountDraft>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCeremonies = async () => {
    const query = new URLSearchParams();
    if (statusFilter !== 'ALL') query.set('status', statusFilter);
    query.set('page', String(page));
    query.set('size', String(PAGE_SIZE));
    const response = await api.get(`/platform-admin/organizations/${organizationId}/ceremonies?${query.toString()}`);
    return response.data as PageResponse<CeremonySummary>;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await fetchCeremonies();
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) {
          showSnackbar(err instanceof Error ? err.message : '행사 목록을 불러오지 못했습니다.', 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, statusFilter, page]);

  const startEdit = (ceremony: CeremonySummary) => {
    setEditingId(ceremony.id);
    setEditDraft({ discountType: ceremony.finalDiscountType, discountValue: ceremony.finalDiscountValue });
  };

  const handleSaveEdit = async (e: FormEvent, ceremonyId: number) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await api.put(
        `/platform-admin/organizations/${organizationId}/ceremonies/${ceremonyId}/final-discount`,
        editDraft,
      );
      const updated = response.data as CeremonySummary;
      setPageData((prev) => (prev ? { ...prev, content: prev.content.map((c) => (c.id === ceremonyId ? updated : c)) } : prev));
      showSnackbar('행사 건별 할인을 저장했습니다.', 'success');
      setEditingId(null);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Percent size={14} />
            행사 건별 재량 할인
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            품목 할인과 별개로 특정 행사 건에만 추가로 매기는 할인입니다. 플랜이 확정된(진행 중) 행사에만 설정할 수
            있습니다.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CeremonyStatus | 'ALL');
            setPage(0);
          }}
          className="px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <ListContainer
        isLoading={isLoading}
        isEmpty={!pageData || pageData.content.length === 0}
        emptyMessage="해당 조건의 행사가 없습니다."
        pagination={
          pageData
            ? {
                page: pageData.page,
                totalPages: pageData.totalPages,
                hasNext: pageData.hasNext,
                totalElements: pageData.totalElements,
                onPageChange: setPage,
              }
            : undefined
        }
      >
        <ul className="divide-y divide-gray-100">
          {pageData?.content.map((ceremony) =>
            editingId === ceremony.id ? (
              <li key={ceremony.id} className="px-4 py-3">
                <form onSubmit={(e) => handleSaveEdit(e, ceremony.id)} className="flex flex-wrap items-end gap-2">
                  <span className="text-sm font-medium text-gray-950 min-w-[140px]">{ceremony.title}</span>
                  <Field label="할인 방식">
                    <select
                      value={editDraft.discountType}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
                      disabled={isSaving}
                      className={inputClass}
                    >
                      {DISCOUNT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="할인 값">
                    <input
                      type="number"
                      min={0}
                      value={editDraft.discountValue === 0 ? '' : editDraft.discountValue}
                      onChange={(e) => setEditDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                      disabled={isSaving}
                      className={`${inputClass} w-28`}
                    />
                  </Field>
                  <div className="flex gap-1.5">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isSaving && <Loader2 size={11} className="animate-spin" />}
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={ceremony.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-950 truncate">{ceremony.title}</span>
                  <span className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_BADGE_CLASS[ceremony.status]}`}>
                    {STATUS_LABEL[ceremony.status]}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    할인 {formatDiscount(ceremony.finalDiscountType, ceremony.finalDiscountValue)}
                  </span>
                </div>
                {canManage &&
                  (ceremony.status === 'IN_PROGRESS' ? (
                    <button
                      onClick={() => startEdit(ceremony)}
                      className="shrink-0 px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 text-[11px] font-medium hover:border-gray-400"
                    >
                      할인 설정
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {ceremony.status === 'DRAFT' ? '플랜 확정 전' : '완료된 행사'}에는 설정할 수 없음
                    </span>
                  ))}
              </li>
            ),
          )}
        </ul>
      </ListContainer>
      {!canManage && <p className="mt-2 text-[11px] text-gray-400">할인 설정은 PLATFORM_OPS 이상만 가능합니다.</p>}
    </div>
  );
};

const inputClass =
  'px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
