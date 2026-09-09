import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, UsageWarning } from './billingCatalog/components';
import { CAPACITY_TYPE_LABEL, inputClass } from './billingCatalog/constants';
import type { CapacityAddOnSummary, UpdateCapacityAddOnRequest } from '../types';

/** 용량 추가구매 상품 수정 — 인라인 편집이 아니라 별도 페이지로 구성한다(사용자 요청, 2026-09-09).
 * capacityType/secondaryCapacityType은 생성 후 불변이라 여기서 다루지 않는다 — 묶음 여부를
 * 바꾸려면 새 상품을 등록해야 한다. */
export const AdminCapacityAddOnEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addOnId = Number(id);

  const [addOn, setAddOn] = useState<CapacityAddOnSummary | null>(null);
  const [draft, setDraft] = useState<UpdateCapacityAddOnRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/capacity-addons');
        const found = (response.data as CapacityAddOnSummary[]).find((a) => a.id === addOnId) ?? null;
        if (!cancelled) {
          if (!found) {
            showSnackbar('용량 추가구매 상품을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/capacity-addons', { replace: true });
            return;
          }
          setAddOn(found);
          setDraft({ unitAmount: found.unitAmount, secondaryUnitAmount: found.secondaryUnitAmount });
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOnId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || draft.unitAmount < 1) {
      showSnackbar('단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    if (addOn?.secondaryCapacityType && (!draft.secondaryUnitAmount || draft.secondaryUnitAmount < 1)) {
      showSnackbar('보조 단위 수량은 1 이상이어야 합니다.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/capacity-addons/${addOnId}`, draft);
      showSnackbar('용량 추가구매 상품을 저장했습니다.', 'success');
      navigate(`/admin/billing-catalog/capacity-addons/${addOnId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '용량 추가구매 상품 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link
        to={`/admin/billing-catalog/capacity-addons/${addOnId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        용량 추가구매 상품 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">용량 추가구매 상품 수정</h1>
        <p className="mt-1 text-sm text-gray-500">가격/할인/판매기간/사용여부는 상세 화면의 "가격 기간 관리"에서 다룹니다.</p>
      </div>

      {isLoading || !addOn || !draft ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="종류(읽기 전용)">
              <input
                type="text"
                value={CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType}
                disabled
                className={`${inputClass} bg-gray-100 text-gray-400`}
              />
            </Field>
            <Field label="단위 수량">
              <input
                type="number"
                min={1}
                value={draft.unitAmount === 0 ? '' : draft.unitAmount}
                onChange={(e) => setDraft((prev) => prev && { ...prev, unitAmount: Number(e.target.value) })}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
            {addOn.secondaryCapacityType && (
              <>
                <Field label="보조 용량(읽기 전용)">
                  <input
                    type="text"
                    value={`${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} (묶음 상품)`}
                    disabled
                    className={`${inputClass} bg-gray-100 text-gray-400`}
                  />
                </Field>
                <Field label="보조 단위 수량">
                  <input
                    type="number"
                    min={1}
                    value={draft.secondaryUnitAmount ? draft.secondaryUnitAmount : ''}
                    onChange={(e) => setDraft((prev) => prev && { ...prev, secondaryUnitAmount: Number(e.target.value) })}
                    disabled={isSaving}
                    className={inputClass}
                  />
                </Field>
              </>
            )}
          </div>

          <UsageWarning count={addOn.usageCount} itemLabel="용량 추가구매 상품" />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/admin/billing-catalog/capacity-addons/${addOnId}`)}
              disabled={isSaving}
            >
              취소
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
