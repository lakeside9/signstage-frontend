import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { BillingPlanSummary, CeremonySummary } from '../types';

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/**
 * 행사(Ceremony) 등록 화면. 플랜 선택이 필수다(signstage-docs
 * business/ceremony-billing-options-review.md 4.10절 — 행사 생성 시 플랜 필수 선택).
 * 카드형으로 플랜별 한도/가격을 보여주고 라디오처럼 하나만 고르게 한다.
 */
export const UserCeremonyCreate: FC = () => {
  const { organizationId } = useParams<{ organizationId: string }>();

  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [title, setTitle] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [created, setCreated] = useState<CeremonySummary | null>(null);

  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/billing-plans');
        if (!cancelled) {
          // 사용 중지(active=false)된 플랜은 신규 선택 대상에서 제외한다.
          setPlans((response.data as BillingPlanSummary[]).filter((plan) => plan.active));
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '과금 플랜을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsPlansLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedPlanId) {
      showSnackbar('플랜을 선택해주세요.', 'error');
      return;
    }
    if (!title.trim()) {
      showSnackbar('행사 제목을 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/ceremonies`, {
        billingPlanId: selectedPlanId,
        title: title.trim(),
      });
      setCreated(response.data as CeremonySummary);
      showSnackbar('행사가 등록되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '행사 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Link
        to={`/org/ceremonies/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        행사 목록으로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">행사 등록</h1>
        <p className="mt-1 text-sm text-gray-500">
          등록 직후엔 플랜을 자유롭게 바꿀 수 있습니다. 플랜을 확정해야 서명자/문서/하위 행사를 등록할 수 있습니다.
        </p>
      </div>

      {created ? (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-2 text-gray-950 font-bold">
              <FileSignature size={18} />
              {created.title}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              플랜: {plans.find((plan) => plan.id === created.billingPlanId)?.name ?? `#${created.billingPlanId}`}
            </p>
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              아직 플랜 확정 전입니다. 서명자/문서/하위 행사를 등록하려면 행사 수정 화면에서 플랜을 확정해주세요.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to={`/org/ceremonies/${organizationId}/${created.id}/edit`}
              className="flex-1 text-center px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              플랜 확정하러 가기
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setTitle('');
                setSelectedPlanId(null);
              }}
              className="flex-1 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              계속 추가하기
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">행사 제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
              placeholder="예: 2026년 상반기 협약식"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">플랜 선택</label>
            {isPlansLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">선택 가능한 플랜이 없습니다. 플랫폼 관리자에게 문의해주세요.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <button
                      type="button"
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      disabled={isLoading}
                      className={`text-left border rounded-lg p-4 transition-colors ${
                        isSelected ? 'border-gray-950 ring-1 ring-gray-950' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-950">{plan.name}</span>
                        {isSelected && <CheckCircle2 size={18} className="text-gray-950" />}
                      </div>
                      <p className="mt-1 text-sm text-gray-950">
                        {formatPrice(plan.salePrice)}
                        {plan.discountValue > 0 && (
                          <span className="ml-1.5 text-xs text-gray-400 line-through">{formatPrice(plan.supplyPrice)}</span>
                        )}
                      </p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <dt>서명자</dt>
                          <dd className="text-gray-700">{plan.maxSigners}명</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>템플릿</dt>
                          <dd className="text-gray-700">{plan.maxTemplates}개</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>테스트 행사</dt>
                          <dd className="text-gray-700">{plan.maxTestEvents}회</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>본행사</dt>
                          <dd className="text-gray-700">{plan.maxMainEvents}회</dd>
                        </div>
                      </dl>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
          >
            {isLoading ? '등록 중...' : '행사 등록'}
          </button>
        </form>
      )}
    </div>
  );
};
