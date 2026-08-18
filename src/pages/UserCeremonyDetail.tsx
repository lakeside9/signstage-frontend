import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, FileSignature, FileText, Loader2, Package, Plus, Sparkles, Users } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  CeremonySummary,
  OptionalFeatureSummary,
} from '../types';

const EVENT_STATUS_LABEL: Record<CeremonyEventStatus, string> = {
  DRAFT: '준비 중',
  READY: '시작 대기',
  STARTED: '진행 중',
  FINISHED: '종료',
};

const EVENT_STATUS_COLOR: Record<CeremonyEventStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  READY: 'bg-blue-50 text-blue-700 border-blue-200',
  STARTED: 'bg-amber-50 text-amber-700 border-amber-200',
  FINISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const EVENT_TYPE_LABEL: Record<CeremonyEventType, string> = { TEST: '테스트', MAIN: '본행사' };

const CAPACITY_TYPE_LABEL: Record<string, string> = {
  SIGNERS: '서명자 수',
  TEMPLATES: '템플릿 업로드 수',
  TEST_EVENTS: '테스트 행사 수',
  MAIN_EVENTS: '본행사 수',
};

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`;

/**
 * 행사(Ceremony) 상세(`/org/ceremonies/:organizationId/:ceremonyId`). 기본 정보 +
 * 용량/선택옵션 추가구매(둘 다 이력 조회 API가 없어 방금 구매한 것만 화면에 안내로 남긴다 —
 * 백엔드에 CapacityPurchase/OptionalFeaturePurchase 목록 조회 엔드포인트가 아직 없다) + 하위
 * 행사(CeremonyEvent) 목록을 한 화면에 담는다. 섹션마다 독립적으로 불러오고 실패해도 서로
 * 막지 않는다(AdminOrganizationDetail과 같은 패턴).
 */
export const UserCeremonyDetail: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [capacityAddOns, setCapacityAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isCapacityLoading, setIsCapacityLoading] = useState(true);
  const [selectedAddOnId, setSelectedAddOnId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasingCapacity, setIsPurchasingCapacity] = useState(false);
  const [purchasedCapacityNote, setPurchasedCapacityNote] = useState<string | null>(null);

  const [optionalFeatures, setOptionalFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(true);
  const [processingFeatureId, setProcessingFeatureId] = useState<number | null>(null);
  const [purchasedFeatureIds, setPurchasedFeatureIds] = useState<number[]>([]);

  const [events, setEvents] = useState<CeremonyEventSummary[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}`);
        const data = response.data as CeremonySummary;
        if (cancelled) return;
        setCeremony(data);

        try {
          const plansRes = await api.get('/billing-plans');
          if (!cancelled) {
            const found = (plansRes.data as BillingPlanSummary[]).find((p) => p.id === data.billingPlanId);
            setPlan(found ?? null);
          }
        } catch {
          // 플랜 이름을 못 띄우는 정도라 상세 조회 자체를 막지 않는다.
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '행사 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate(`/org/ceremonies/${organizationId}`, { replace: true });
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
  }, [organizationId, ceremonyId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/capacity-addons');
        if (!cancelled) {
          setCapacityAddOns(response.data as CapacityAddOnSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '용량 추가구매 상품을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsCapacityLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/optional-features');
        if (!cancelled) {
          setOptionalFeatures(response.data as OptionalFeatureSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '선택옵션을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsFeaturesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEvents = async () => {
    const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/events`);
    return response.data as CeremonyEventSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchEvents();
        if (!cancelled) {
          setEvents(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '하위 행사 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsEventsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const handlePurchaseCapacity = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAddOnId) {
      showSnackbar('추가구매할 항목을 선택해주세요.', 'error');
      return;
    }
    if (quantity < 1) {
      showSnackbar('수량은 1 이상이어야 합니다.', 'error');
      return;
    }

    setIsPurchasingCapacity(true);
    try {
      await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/capacity-purchases`, {
        capacityAddOnId: selectedAddOnId,
        quantity,
      });
      const addOn = capacityAddOns.find((item) => item.id === selectedAddOnId);
      showSnackbar('용량을 추가구매했습니다.', 'success');
      setPurchasedCapacityNote(
        addOn ? `방금 구매: ${CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} +${addOn.unitAmount * quantity}` : null,
      );
      setQuantity(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : '용량 추가구매에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsPurchasingCapacity(false);
    }
  };

  const handlePurchaseFeature = async (optionalFeatureId: number) => {
    setProcessingFeatureId(optionalFeatureId);
    try {
      await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/optional-feature-purchases`, {
        optionalFeatureId,
      });
      showSnackbar('선택옵션을 추가구매했습니다.', 'success');
      setPurchasedFeatureIds((prev) => [...prev, optionalFeatureId]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '선택옵션 추가구매에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingFeatureId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!ceremony) {
    return null;
  }

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
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <FileSignature size={20} className="text-gray-400" />
          {ceremony.title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">플랜: {plan?.name ?? `#${ceremony.billingPlanId}`}</p>
      </div>

      <div className="flex gap-2">
        <Link
          to={`/org/ceremonies/${organizationId}/${ceremonyId}/signers`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
        >
          <Users size={16} />
          서명자 관리
        </Link>
        <Link
          to={`/org/ceremonies/${organizationId}/${ceremonyId}/templates`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
        >
          <FileText size={16} />
          문서 양식 관리
        </Link>
      </div>

      {/* 용량 추가구매 */}
      <section className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <Package size={14} />
          용량 추가구매
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          한 번 구매하면 취소할 수 없습니다. 구매 이력 조회는 아직 지원하지 않아 방금 구매한 항목만 아래에 표시됩니다.
        </p>
        {isCapacityLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : capacityAddOns.length === 0 ? (
          <p className="text-sm text-gray-500">추가구매 가능한 상품이 없습니다.</p>
        ) : (
          <form onSubmit={handlePurchaseCapacity} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">항목</label>
              <select
                value={selectedAddOnId ?? ''}
                onChange={(e) => setSelectedAddOnId(e.target.value ? Number(e.target.value) : null)}
                disabled={isPurchasingCapacity}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                <option value="">선택</option>
                {capacityAddOns.map((addOn) => (
                  <option key={addOn.id} value={addOn.id}>
                    {CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} +{addOn.unitAmount} —{' '}
                    {formatPrice(addOn.salePrice)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">수량</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={isPurchasingCapacity}
                className="w-20 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isPurchasingCapacity}
              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isPurchasingCapacity ? '구매 중...' : '구매'}
            </button>
          </form>
        )}
        {purchasedCapacityNote && <p className="mt-3 text-xs text-emerald-600">{purchasedCapacityNote}</p>}
      </section>

      {/* 선택옵션 추가구매 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <Sparkles size={14} />
          선택옵션 추가구매
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          구매한 옵션은 하위 행사별로 적용 여부를 켜고 끌 수 있습니다(하위 행사 상세에서 설정).
        </p>
        {isFeaturesLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : optionalFeatures.length === 0 ? (
          <p className="text-sm text-gray-500">구매 가능한 선택옵션이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {optionalFeatures.map((feature) => (
              <li key={feature.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-gray-950">{feature.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(feature.salePrice)}</p>
                </div>
                {purchasedFeatureIds.includes(feature.id) ? (
                  <span className="text-xs text-emerald-600">방금 구매함</span>
                ) : (
                  <button
                    onClick={() => handlePurchaseFeature(feature.id)}
                    disabled={processingFeatureId === feature.id}
                    className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                  >
                    {processingFeatureId === feature.id ? '구매 중...' : '구매'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 하위 행사 목록 */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <CalendarClock size={14} />
            하위 행사
          </h2>
          <Link
            to={`/org/ceremonies/${organizationId}/${ceremonyId}/events/new`}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
          >
            <Plus size={12} />
            새 하위 행사
          </Link>
        </div>

        <ListContainer isLoading={isEventsLoading} isEmpty={events.length === 0} emptyMessage="아직 등록된 하위 행사가 없습니다.">
          <ul className="divide-y divide-gray-100">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  to={`/org/ceremonies/${organizationId}/${ceremonyId}/events/${event.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-950 truncate">{event.name}</p>
                    <p className="text-xs text-gray-500">{EVENT_TYPE_LABEL[event.eventType]}</p>
                  </div>
                  <span
                    className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${EVENT_STATUS_COLOR[event.status]}`}
                  >
                    {EVENT_STATUS_LABEL[event.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </ListContainer>
      </section>
    </div>
  );
};
