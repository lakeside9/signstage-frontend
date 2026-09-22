import { useEffect, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { formatCurrency } from '../utils/internationalization';
import type { OrganizationSummary } from '../types';

type Product = {
  description?: string | null;
  id: number; name: string; type: string; includedQuantity: number;
  salePrice: number; saleUnitQuantity: number; maxPurchaseQuantity: number | null;
};
type Plan = {
  id: number; name: string; subscription: boolean; subtotal: number;
  appliedPrice: number; partnerDiscount: boolean; products: Product[];
};
type Catalog = { organizationName: string; currencyCode: string; asOfDate: string; plans: Plan[]; additionalProducts: Product[] };

export function UserBillingSimulator() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [planId, setPlanId] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/organizations');
        const organization = (response.data as OrganizationSummary[])[0];
        if (!organization) throw new Error('소속 판매사가 없습니다. 회사 등록 후 이용해주세요.');
        const result = await api.get(`/organizations/${organization.id}/billing-simulator`);
        if (!cancelled) {
          const data = result.data as Catalog;
          setCatalog(data);
          setPlanId(data.plans[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '과금 정보를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-gray-400" aria-label="불러오는 중" /></div>;
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (!catalog) return null;

  const plan = catalog.plans.find((item) => item.id === planId);
  const price = (amount: number) => formatCurrency(amount, catalog.currencyCode);
  const purchasableProducts = catalog.additionalProducts.map((product) => {
    const includedQuantity = plan?.products.find((item) => item.id === product.id)?.includedQuantity ?? 0;
    return {
      ...product,
      includedQuantity,
      maxPurchaseQuantity: product.type === 'EVENT_EFFECT_BUNDLE'
        ? Math.max(0, 1 - includedQuantity) : product.maxPurchaseQuantity,
    };
  });
  const additional = purchasableProducts.reduce((sum, product) =>
    sum + product.salePrice * (quantities[product.id] ?? 0), 0);
  const total = (plan?.appliedPrice ?? 0) + additional;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Calculator size={22} />과금 시뮬레이터</h1>
        <p className="mt-2 text-sm text-gray-500">플랜과 추가 구매 수량을 선택해 행사 1건의 플랫폼 이용료를 확인하세요.</p>
        <p className="mt-1 text-xs text-gray-400">{catalog.organizationName} · {catalog.asOfDate} 기준 · {catalog.currencyCode}</p>
      </div>
      {catalog.plans.length === 0 ? (
        <p className="py-12 text-center text-gray-500">현재 계산할 수 있는 플랫폼 이용료 플랜이 없습니다.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">
          <div className="space-y-4 min-w-0">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <label htmlFor="simulator-plan" className="block mb-2 text-sm font-semibold">과금 플랜</label>
              <select id="simulator-plan" value={planId ?? ''} className="w-full border border-gray-200 rounded-md p-2 text-sm"
                onChange={(e) => { setPlanId(Number(e.target.value)); setQuantities({}); }}>
                {catalog.plans.map((item) => <option key={item.id} value={item.id}>{item.name}{item.subscription ? ' (구독형)' : ''}</option>)}
              </select>
              {plan?.partnerDiscount && <p className="mt-2 text-xs text-indigo-600">판매사 전용 플랜 할인이 적용되었습니다.</p>}
              {plan?.subscription && <p className="mt-2 text-xs text-gray-500">구독형도 행사 1건 기준으로 계산합니다. 구독 계약 총액 및 잔여 이용권은 반영하지 않습니다.</p>}
              {plan && (
                <section aria-label="선택한 플랜 상세" className="mt-4 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold">{plan.name}</h2>
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{plan.subscription ? '구독형' : '일반형'}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                    <div><dt className="text-xs text-gray-500">플랜 소계</dt><dd className="mt-1 tabular-nums">{price(plan.subtotal)}</dd></div>
                    <div><dt className="text-xs text-gray-500">플랜 할인</dt><dd className="mt-1 text-emerald-700 tabular-nums">−{price(plan.subtotal - plan.appliedPrice)}</dd></div>
                    <div><dt className="text-xs text-gray-500">할인 적용가 (세금 별도)</dt><dd className="mt-1 font-semibold tabular-nums">{price(plan.appliedPrice)}</dd></div>
                  </dl>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <caption className="mb-2 text-left text-xs text-gray-500">플랫폼 이용료 대상 상품 구성</caption>
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr><th scope="col" className="px-3 py-2">상품</th><th scope="col" className="px-3 py-2 text-right">기본 포함량</th><th scope="col" className="px-3 py-2 text-right">추가 구매 단위</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {plan.products.map((product) => (
                          <tr key={product.id}>
                            <td className="px-3 py-2">{product.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{product.includedQuantity === 0 ? '미포함' : product.includedQuantity}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{product.maxPurchaseQuantity === 0 ? '추가 구매 불가' : product.saleUnitQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </section>
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold">추가 구매</h2>
                <button type="button" className="text-xs text-gray-500" onClick={() => setQuantities({})}>수량 초기화</button>
              </div>
              <p className="mb-3 text-xs text-gray-500">선택한 플랜의 구성과 관계없이 현재 판매 중인 플랫폼 이용료 상품을 추가할 수 있습니다.</p>
              <div className="space-y-2 overflow-x-auto">
                {purchasableProducts.length === 0 && <p className="text-sm text-gray-500">추가 구매 가능한 플랫폼 이용료 상품이 없습니다.</p>}
                {purchasableProducts.map((product) => {
                  const quantity = quantities[product.id] ?? 0;
                  const unit = product.saleUnitQuantity;
                  const maxUnits = product.maxPurchaseQuantity == null ? undefined : Math.floor(product.maxPurchaseQuantity / unit);
                  return (
                    <div key={product.id} className="flex min-w-[600px] items-center gap-4 rounded-md border border-gray-200 px-3 py-2.5">
                      <div className="min-w-24 flex-1">
                        <p className="text-sm font-medium">{product.name}</p>
                        {product.description?.trim() && (
                          <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-500">{product.description}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-500 tabular-nums">1개당 {price(product.salePrice)}</span>
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600">
                          <input type="number" min={0} step={1} max={maxUnits} value={quantity === 0 ? '' : quantity / unit} placeholder="0"
                            disabled={maxUnits === 0} aria-label={`${product.name} 추가 구매 단위`}
                            onChange={(e) => {
                              const count = Number(e.target.value);
                              const normalized = Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), maxUnits ?? Number.MAX_SAFE_INTEGER)) : 0;
                              // number 입력은 같은 숫자의 '01' 표기를 유지할 수 있어 표시값도 정규화한다.
                              e.currentTarget.value = normalized === 0 ? '' : String(normalized);
                              setQuantities((prev) => ({ ...prev, [product.id]: normalized * unit }));
                            }}
                            className="w-20 rounded border border-gray-200 p-1.5 text-right disabled:bg-gray-100" />
                          <span>{unit === 1 ? '개' : `× ${unit}개`}</span>
                        </label>
                      <span className="w-24 shrink-0 text-xs text-gray-500">{product.maxPurchaseQuantity == null ? '한도 없음' : `구매 한도 ${product.maxPurchaseQuantity}개`}</span>
                      <span className="ml-auto w-28 shrink-0 text-right text-sm font-medium tabular-nums">{price(product.salePrice * quantity)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <aside className="rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-4">
            <h2 className="text-sm font-bold mb-4">예상 플랫폼 이용료</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt>플랜 소계</dt><dd>{price(plan?.subtotal ?? 0)}</dd></div>
              <div className="flex justify-between"><dt>플랜 할인</dt><dd>−{price((plan?.subtotal ?? 0) - (plan?.appliedPrice ?? 0))}</dd></div>
              <div className="flex justify-between"><dt>추가 구매</dt><dd>{price(additional)}</dd></div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold"><dt>합계 (세금 별도)</dt><dd aria-live="polite">{price(total)}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-gray-500">현재 카탈로그 가격으로 계산한 예상 금액입니다. 고객 견적은 포함하지 않으며, 별도 협의 비용과 실제 구매 시점의 가격·조건에 따라 최종 금액이 달라질 수 있습니다.</p>
            <p className="mt-2 text-xs text-gray-500">시뮬레이션으로 행사 생성, 구매, 구독 차감은 발생하지 않습니다.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
