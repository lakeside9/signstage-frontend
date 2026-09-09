import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, UsageWarning } from './billingCatalog/components';
import { PLAN_CAPACITY_TYPE_OPTIONS, inputClass } from './billingCatalog/constants';
import type { BillingPlanSummary, CapacityAddOnSummary, OptionalFeatureSummary, UpdateBillingPlanRequest } from '../types';

/** 과금 플랜 수정 — 인라인 편집이 아니라 별도 페이지로 구성한다(사용자 요청, 2026-09-09).
 * 가격/할인/판매기간/사용여부는 여기서 다루지 않는다 — 상세 화면의 "가격 기간 관리"에서 기간
 * 단위로 관리한다. */
export const AdminBillingPlanEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [features, setFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [addOns, setAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [draft, setDraft] = useState<UpdateBillingPlanRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plansRes, featuresRes, addOnsRes] = await Promise.all([
          api.get('/billing-plans'),
          api.get('/optional-features'),
          api.get('/capacity-addons'),
        ]);
        const found = (plansRes.data as BillingPlanSummary[]).find((p) => p.id === planId) ?? null;
        if (!cancelled) {
          if (!found) {
            showSnackbar('과금 플랜을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/plans', { replace: true });
            return;
          }
          setPlan(found);
          setFeatures(featuresRes.data as OptionalFeatureSummary[]);
          setAddOns(addOnsRes.data as CapacityAddOnSummary[]);
          setDraft({
            name: found.name,
            capacities: { ...found.capacities },
            optionalFeatureIds: found.optionalFeatureIds,
            capacityAddOnIds: found.capacityAddOnIds,
          });
        }
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '과금 플랜을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const addOnLabel = (id: number) => {
    const addOn = addOns.find((a) => a.id === id);
    if (!addOn) return `#${id}`;
    return `${addOn.capacityType} +${addOn.unitAmount}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/platform-admin/billing-plans/${planId}`, { ...draft, name: draft.name.trim() });
      showSnackbar('과금 플랜을 저장했습니다.', 'success');
      navigate(`/admin/billing-catalog/plans/${planId}`);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '과금 플랜 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <Link
        to={`/admin/billing-catalog/plans/${planId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        과금 플랜 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">과금 플랜 수정</h1>
        <p className="mt-1 text-sm text-gray-500">가격/할인/판매기간/사용여부는 상세 화면의 "가격 기간 관리"에서 다룹니다.</p>
      </div>

      {isLoading || !plan || !draft ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="이름">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => prev && { ...prev, name: e.target.value })}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {PLAN_CAPACITY_TYPE_OPTIONS.map((option) => (
              <Field key={option.value} label={`${option.label} 한도`}>
                <input
                  type="number"
                  min={0}
                  value={draft.capacities[option.value] === 0 ? '' : draft.capacities[option.value]}
                  onChange={(e) =>
                    setDraft((prev) => prev && { ...prev, capacities: { ...prev.capacities, [option.value]: Number(e.target.value) } })
                  }
                  disabled={isSaving}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">포함 선택옵션</span>
            {features.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 선택옵션이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {features.map((feature) => (
                  <label key={feature.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.optionalFeatureIds.includes(feature.id)}
                      disabled={isSaving}
                      onChange={(e) =>
                        setDraft(
                          (prev) =>
                            prev && {
                              ...prev,
                              optionalFeatureIds: e.target.checked
                                ? [...prev.optionalFeatureIds, feature.id]
                                : prev.optionalFeatureIds.filter((fid) => fid !== feature.id),
                            },
                        )
                      }
                    />
                    {feature.name}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">이미 확정/구매해서 쓰고 있는 행사는 변경 시점 스냅샷 기준이라 영향받지 않습니다.</p>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">구매 가능 용량 추가구매 상품</span>
            {addOns.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 용량 추가구매 상품이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {addOns.map((addOn) => (
                  <label key={addOn.id} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.capacityAddOnIds.includes(addOn.id)}
                      disabled={isSaving}
                      onChange={(e) =>
                        setDraft(
                          (prev) =>
                            prev && {
                              ...prev,
                              capacityAddOnIds: e.target.checked
                                ? [...prev.capacityAddOnIds, addOn.id]
                                : prev.capacityAddOnIds.filter((aid) => aid !== addOn.id),
                            },
                        )
                      }
                    />
                    {addOnLabel(addOn.id)}
                  </label>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              체크한 상품만 이 플랜의 행사가 구매할 수 있습니다(무료 포함 아님). 이미 진행 중인 행사는 플랜 확정/변경 시점 스냅샷
              기준이라 영향받지 않습니다.
            </p>
          </div>

          <UsageWarning count={plan.usageCount} itemLabel="플랜" />

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(`/admin/billing-catalog/plans/${planId}`)} disabled={isSaving}>
              취소
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
