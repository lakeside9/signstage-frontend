import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { Field, UsageWarning } from './billingCatalog/components';
import { TOGGLE_UNIT_PRODUCT_TYPES, UNIT_PRODUCT_TYPE_LABEL, inputClass } from './billingCatalog/constants';
import type { BillingPlanSummary, PlanUnitProductLine, UnitProductSummary, UpdateBillingPlanRequest } from '../types';

/**
 * `includedQuantity: null`은 "이 단위 상품은 이 플랜 구성에 아예 없음"(추가구매도 안 됨)이다 —
 * 숫자(0 포함)를 입력해야 비로소 이 플랜의 행사가 그 상품을 추가구매할 수 있다(행이 존재하는 것
 * 자체가 추가구매 후보라는 뜻, 2026-09-10 `purchasable` 필드 폐지 — `AdminBillingPlanCreate.tsx`
 * 와 같은 이유).
 */
interface LineDraft {
  includedQuantity: number | null;
}

/** 과금 플랜 수정 — 인라인 편집이 아니라 별도 페이지로 구성한다(사용자 요청, 2026-09-09).
 * 할인/사용여부/할인기간은 여기서 다루지 않는다 — 상세 화면의 "할인 기간 관리"에서 기간
 * 단위로 관리한다. 단위 상품 구성은 여기서 통째로 교체한다(signstage-docs
 * business/billing-catalog-unit-product-model-redesign-review.md 결정, 2026-09-10). */
export const AdminBillingPlanEdit: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [products, setProducts] = useState<UnitProductSummary[]>([]);
  const [name, setName] = useState('');
  const [lineDrafts, setLineDrafts] = useState<Record<number, LineDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plansRes, productsRes] = await Promise.all([api.get('/billing-plans'), api.get('/unit-products')]);
        const found = (plansRes.data as BillingPlanSummary[]).find((p) => p.id === planId) ?? null;
        const allProducts = productsRes.data as UnitProductSummary[];
        if (!cancelled) {
          if (!found) {
            showSnackbar('과금 플랜을 찾을 수 없습니다.', 'error');
            navigate('/admin/billing-catalog/plans', { replace: true });
            return;
          }
          setPlan(found);
          setProducts(allProducts);
          setName(found.name);
          const drafts: Record<number, LineDraft> = Object.fromEntries(
            allProducts.map((p) => [p.id, { includedQuantity: null }]),
          );
          for (const line of found.unitProducts) {
            drafts[line.unitProductId] = { includedQuantity: line.includedQuantity };
          }
          setLineDrafts(drafts);
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

  const buildLines = (): PlanUnitProductLine[] =>
    Object.entries(lineDrafts)
      .filter((entry): entry is [string, { includedQuantity: number }] => entry[1].includedQuantity !== null)
      .map(([unitProductId, line]) => ({
        unitProductId: Number(unitProductId),
        includedQuantity: line.includedQuantity,
      }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showSnackbar('플랜 이름을 입력해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const body: UpdateBillingPlanRequest = { name: name.trim(), unitProducts: buildLines() };
      await api.put(`/platform-admin/billing-plans/${planId}`, body);
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
        <p className="mt-1 text-sm text-gray-500">할인/할인기간/사용여부는 상세 화면의 "할인 기간 관리"에서 다룹니다.</p>
      </div>

      {isLoading || !plan ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="이름">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-500 mb-1">단위 상품 구성</span>
            {products.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 단위 상품이 없습니다.</p>
            ) : (
              <div className="rounded-md border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">단위 상품</th>
                      <th className="text-left px-3 py-2 font-medium w-32">기본 포함 수량</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((product) => {
                      const line = lineDrafts[product.id] ?? { includedQuantity: null };
                      const isToggle = TOGGLE_UNIT_PRODUCT_TYPES.includes(product.type);
                      return (
                        <tr key={product.id}>
                          <td className="px-3 py-2">
                            <span className="text-gray-950">{product.name}</span>
                            <span className="ml-1.5 text-xs text-gray-400">
                              {UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <FormattedNumberInput
                              min={0}
                              max={isToggle ? 1 : undefined}
                              value={line.includedQuantity ?? ''}
                              disabled={isSaving}
                              placeholder="—"
                              onChange={(raw) => {
                                setLineDrafts((prev) => ({
                                  ...prev,
                                  [product.id]: { includedQuantity: raw === '' ? null : Number(raw) },
                                }));
                              }}
                              className={`${inputClass} w-24`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              수량을 입력한 상품(0 포함)만 이 플랜 구성에 포함됩니다 — 빈 칸으로 두면 이 플랜과 무관한 상품입니다. 0을
              입력하면 기본 포함은 없지만 추가구매 후보가 되고, 1 이상이면 그 수량만큼 기본 포함됩니다. 이벤트 효과
              묶음은 수량이 0 또는 1만 가능합니다. 이미 확정/구매해서 쓰고 있는 행사는 변경 시점 스냅샷 기준이라
              영향받지 않습니다.
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
