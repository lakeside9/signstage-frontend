import { useEffect, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Percent } from 'lucide-react';
import { Button } from '../components/Button';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type { CeremonyStatus, CeremonySummary, DiscountType } from '../types';

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'PERCENT', label: '퍼센트' },
  { value: 'FIXED_AMOUNT', label: '정액' },
];

const STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '준비 중(플랜 미확정)',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
};

const formatDiscount = (discountType: DiscountType, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatCurrency(discountValue);

interface DiscountDraft {
  discountType: DiscountType;
  discountValue: number;
}

/**
 * 행사 건별 재량 할인 상세 — `AdminCeremonyDiscounts`(목록)의 "상세"에서 들어온다
 * (signstage-docs business/discount-management-screen-separation-review.md 결정 #2, 목록
 * 행에 이미 있는 organizationId를 경로에 그대로 포함해 기존 조직 하위 엔드포인트를 재사용).
 * 조회는 `GET .../organizations/{organizationId}/ceremonies/{ceremonyId}`(신규, 단건),
 * 수정은 기존 `PUT .../ceremonies/{ceremonyId}/final-discount`를 그대로 쓴다. 플랜이 확정된
 * (IN_PROGRESS) 행사에만 설정할 수 있다.
 */
export const AdminCeremonyDiscountDetail: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<DiscountDraft>({ discountType: 'PERCENT', discountValue: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_CEREMONY_FINAL_DISCOUNT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/platform-admin/organizations/${organizationId}/ceremonies/${ceremonyId}`);
        if (!cancelled) setCeremony(response.data as CeremonySummary);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '행사를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const startEdit = () => {
    if (!ceremony) return;
    setDraft({ discountType: ceremony.finalDiscountType, discountValue: ceremony.finalDiscountValue });
    setIsEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await api.put(
        `/platform-admin/organizations/${organizationId}/ceremonies/${ceremonyId}/final-discount`,
        draft,
      );
      setCeremony(response.data as CeremonySummary);
      showSnackbar('행사 건별 할인을 저장했습니다.', 'success');
      setIsEditing(false);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link to="/admin/ceremony-discounts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={14} />
        행사 건별 재량 할인 목록으로
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : !ceremony ? (
        <p className="text-sm text-gray-400">행사를 찾을 수 없습니다.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-xl">
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-1.5">
            <Percent size={18} />
            {ceremony.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{STATUS_LABEL[ceremony.status]}</p>

          <div className="mt-6 space-y-4">
            <Row label="현재 재량 할인">{formatDiscount(ceremony.finalDiscountType, ceremony.finalDiscountValue)}</Row>

            {isEditing ? (
              <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-md p-3">
                <Field label="할인 방식">
                  <select
                    value={draft.discountType}
                    onChange={(e) => setDraft((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}
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
                    value={draft.discountValue === 0 ? '' : draft.discountValue}
                    onChange={(e) => setDraft((prev) => ({ ...prev, discountValue: Number(e.target.value) }))}
                    disabled={isSaving}
                    className={`${inputClass} w-28`}
                  />
                </Field>
                <div className="flex gap-1.5">
                  <Button type="submit" size="sm" disabled={isSaving}>
                    {isSaving && <Loader2 size={11} className="animate-spin" />}
                    저장
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    취소
                  </Button>
                </div>
              </form>
            ) : (
              canManage &&
              (ceremony.status === 'IN_PROGRESS' ? (
                <Button variant="secondary" size="sm" onClick={startEdit}>
                  할인 설정
                </Button>
              ) : (
                <p className="text-xs text-gray-400">
                  {ceremony.status === 'DRAFT' ? '플랜 확정 전' : '완료된 행사'}에는 설정할 수 없습니다.
                </p>
              ))
            )}
            {!canManage && <p className="text-[11px] text-gray-400">할인 설정은 권한이 있는 관리자만 가능합니다.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-0.5 text-sm font-medium text-gray-950">{children}</p>
  </div>
);

const inputClass =
  'px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all disabled:bg-gray-100';

const Field: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);
