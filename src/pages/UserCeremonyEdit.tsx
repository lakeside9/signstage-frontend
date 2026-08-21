import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  History,
  Info,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  BillingPlanSummary,
  CapacityAddOnSummary,
  CapacityPurchaseSummary,
  CeremonyPlanHistorySummary,
  CeremonyStatus,
  CeremonySummary,
  EstimatedTotal,
  OptionalFeaturePurchaseSummary,
  OptionalFeatureSummary,
  PurchaseStatus,
} from '../types';

const CAPACITY_TYPE_LABEL: Record<string, string> = {
  SIGNERS: '서명자 수',
  TEMPLATES: '템플릿 업로드 수',
  TEST_EVENTS: '테스트 행사 수',
  MAIN_EVENTS: '본행사 수',
  TABLETS: '태블릿 수',
};

/** UserCeremonyDetail.tsx의 상태 배지와 같은 라벨/색을 쓴다. */
const CEREMONY_STATUS_LABEL: Record<CeremonyStatus, string> = {
  DRAFT: '플랜 확정 대기',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
};
const CEREMONY_STATUS_COLOR: Record<CeremonyStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: '대기중',
  APPROVED: '승인됨',
  REJECTED: '반려됨',
};

const PURCHASE_STATUS_BADGE_CLASS: Record<PurchaseStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`;
const formatDiscount = (discountType: string, discountValue: number) =>
  discountType === 'PERCENT' ? `${discountValue}%` : formatPrice(discountValue);

const infoInputClass =
  'w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100';

const PurchaseStatusBadge: FC<{ status: PurchaseStatus }> = ({ status }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${PURCHASE_STATUS_BADGE_CLASS[status]}`}>
    {PURCHASE_STATUS_LABEL[status]}
  </span>
);

/**
 * 행사(Ceremony) 수정(`/ceremonies/:organizationId/:ceremonyId/edit`). 용량/선택옵션
 * 추가구매를 행사 상세(`UserCeremonyDetail`)에서 분리해 여기로 옮겼다 — 상세 화면은 조회
 * 중심(서명자/문서양식/하위행사 목록)으로 두고, 행사 자체에 변화를 주는 조작(이름/설명 수정,
 * 플랜 변경/확정, 추가구매)은 별도 수정 화면에 모은다.
 *
 * 플랜은 확정 전(DRAFT)에만 바꿀 수 있고, "플랜 확정"으로 DRAFT → IN_PROGRESS로 단방향
 * 전이하면 그때부터 바꿀 수 없다(signstage-docs business/ceremony-plan-confirmation-review.md).
 * 서명자/문서/하위 행사는 플랜 확정 후에만 등록할 수 있다. 플랜 변경 이력은 그 시점의
 * 이름/가격/한도 스냅샷까지 남는다.
 *
 * 추가구매는 요청 즉시 반영되지 않는다 — 플랫폼 관리자가 승인해야 유효 한도/구매한 선택옵션에
 * 반영된다(signstage-docs business/ceremony-billing-options-review.md). 요청자 본인 이력
 * 조회 API로 대기중(PENDING)/승인됨(APPROVED)/반려됨(REJECTED) 상태를 그대로 보여준다.
 */
export const UserCeremonyEdit: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<number | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false);

  const [planHistory, setPlanHistory] = useState<CeremonyPlanHistorySummary[]>([]);
  const [isPlanHistoryLoading, setIsPlanHistoryLoading] = useState(true);
  const [isPlanHistoryModalOpen, setIsPlanHistoryModalOpen] = useState(false);

  const [estimatedTotal, setEstimatedTotal] = useState<EstimatedTotal | null>(null);
  const [isEstimatedTotalLoading, setIsEstimatedTotalLoading] = useState(true);

  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [organizingInstitutionDraft, setOrganizingInstitutionDraft] = useState('');
  const [organizingDepartmentDraft, setOrganizingDepartmentDraft] = useState('');
  const [contactNameDraft, setContactNameDraft] = useState('');
  const [contactTitleDraft, setContactTitleDraft] = useState('');
  const [contactPhoneDraft, setContactPhoneDraft] = useState('');
  const [contactEmailDraft, setContactEmailDraft] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  const [capacityAddOns, setCapacityAddOns] = useState<CapacityAddOnSummary[]>([]);
  const [isCapacityLoading, setIsCapacityLoading] = useState(true);
  const [selectedAddOnId, setSelectedAddOnId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasingCapacity, setIsPurchasingCapacity] = useState(false);
  const [capacityPurchases, setCapacityPurchases] = useState<CapacityPurchaseSummary[]>([]);
  const [isCapacityHistoryLoading, setIsCapacityHistoryLoading] = useState(true);

  const [optionalFeatures, setOptionalFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(true);
  const [processingFeatureId, setProcessingFeatureId] = useState<number | null>(null);
  const [featurePurchases, setFeaturePurchases] = useState<OptionalFeaturePurchaseSummary[]>([]);
  const [isFeatureHistoryLoading, setIsFeatureHistoryLoading] = useState(true);
  const [isFeatureHistoryModalOpen, setIsFeatureHistoryModalOpen] = useState(false);

  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;
  const detailPath = `/ceremonies/${organizationId}/${ceremonyId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(basePath);
        if (!cancelled) {
          const data = response.data as CeremonySummary;
          setCeremony(data);
          setTitleDraft(data.title);
          setDescriptionDraft(data.description ?? '');
          setOrganizingInstitutionDraft(data.organizingInstitution ?? '');
          setOrganizingDepartmentDraft(data.organizingDepartment ?? '');
          setContactNameDraft(data.contactName ?? '');
          setContactTitleDraft(data.contactTitle ?? '');
          setContactPhoneDraft(data.contactPhone ?? '');
          setContactEmailDraft(data.contactEmail ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '행사 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate(detailPath, { replace: true });
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
        const response = await api.get('/billing-plans');
        if (!cancelled) {
          setPlans(response.data as BillingPlanSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '플랜 정보를 불러오지 못했습니다.';
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

  const fetchPlanHistory = async () => {
    const response = await api.get(`${basePath}/plan/history`);
    return response.data as CeremonyPlanHistorySummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPlanHistory();
        if (!cancelled) {
          setPlanHistory(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '플랜 변경 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsPlanHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const fetchEstimatedTotal = async () => {
    const response = await api.get(`${basePath}/estimated-total`);
    return response.data as EstimatedTotal;
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchEstimatedTotal();
        if (!cancelled) {
          setEstimatedTotal(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '예상 청구 금액을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsEstimatedTotalLoading(false);
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

  const fetchCapacityPurchases = async () => {
    const response = await api.get(`${basePath}/capacity-purchases`);
    return response.data as CapacityPurchaseSummary[];
  };

  const fetchFeaturePurchases = async () => {
    const response = await api.get(`${basePath}/optional-feature-purchases`);
    return response.data as OptionalFeaturePurchaseSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchCapacityPurchases();
        if (!cancelled) {
          setCapacityPurchases(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '용량 추가구매 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsCapacityHistoryLoading(false);
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
        const data = await fetchFeaturePurchases();
        if (!cancelled) {
          setFeaturePurchases(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '선택옵션 추가구매 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsFeatureHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const handleUpdateCeremony = async (e: FormEvent) => {
    e.preventDefault();
    if (!titleDraft.trim()) {
      showSnackbar('행사명을 입력해주세요.', 'error');
      return;
    }

    setIsSavingInfo(true);
    try {
      const response = await api.put(basePath, {
        title: titleDraft.trim(),
        description: descriptionDraft.trim() || null,
        organizingInstitution: organizingInstitutionDraft.trim() || null,
        organizingDepartment: organizingDepartmentDraft.trim() || null,
        contactName: contactNameDraft.trim() || null,
        contactTitle: contactTitleDraft.trim() || null,
        contactPhone: contactPhoneDraft.trim() || null,
        contactEmail: contactEmailDraft.trim() || null,
      });
      setCeremony(response.data as CeremonySummary);
      showSnackbar('행사 정보를 저장했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '행사 정보 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleChangePlan = async () => {
    if (!selectedNewPlanId) {
      showSnackbar('변경할 플랜을 선택해주세요.', 'error');
      return;
    }

    setIsChangingPlan(true);
    try {
      const response = await api.put(`${basePath}/plan`, { billingPlanId: selectedNewPlanId });
      setCeremony(response.data as CeremonySummary);
      setSelectedNewPlanId(null);
      showSnackbar('플랜을 변경했습니다.', 'success');
      setPlanHistory(await fetchPlanHistory());
      setEstimatedTotal(await fetchEstimatedTotal());
    } catch (err) {
      const message = err instanceof Error ? err.message : '플랜 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleConfirmPlan = async () => {
    setIsConfirmingPlan(true);
    try {
      const response = await api.post(`${basePath}/plan/confirm`);
      setCeremony(response.data as CeremonySummary);
      showSnackbar('플랜을 확정했습니다. 이제 서명자/문서/하위 행사를 등록할 수 있습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '플랜 확정에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsConfirmingPlan(false);
    }
  };

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
      await api.post(`${basePath}/capacity-purchases`, {
        capacityAddOnId: selectedAddOnId,
        quantity,
      });
      showSnackbar('용량 추가구매를 요청했습니다. 플랫폼 관리자 승인 후 반영됩니다.', 'success');
      setQuantity(1);
      setCapacityPurchases(await fetchCapacityPurchases());
    } catch (err) {
      const message = err instanceof Error ? err.message : '용량 추가구매 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsPurchasingCapacity(false);
    }
  };

  const handlePurchaseFeature = async (optionalFeatureId: number) => {
    setProcessingFeatureId(optionalFeatureId);
    try {
      await api.post(`${basePath}/optional-feature-purchases`, {
        optionalFeatureId,
      });
      showSnackbar('선택옵션 추가구매를 요청했습니다. 플랫폼 관리자 승인 후 반영됩니다.', 'success');
      setFeaturePurchases(await fetchFeaturePurchases());
    } catch (err) {
      const message = err instanceof Error ? err.message : '선택옵션 추가구매 요청에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingFeatureId(null);
    }
  };

  /** REJECTED는 재요청할 수 있어야 하므로 PENDING/APPROVED가 있을 때만 구매 버튼을 막는다. */
  const hasActiveFeaturePurchase = (optionalFeatureId: number) =>
    featurePurchases.some(
      (purchase) => purchase.optionalFeatureId === optionalFeatureId && purchase.status !== 'REJECTED',
    );

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

  const isCompleted = ceremony.status === 'COMPLETED';
  const isDraft = ceremony.status === 'DRAFT';
  // "선택한 플랜" 표시는 라이브 카탈로그가 아니라 확정 시점(또는 가장 최근 변경 시점) 스냅샷을
  // 쓴다 — 카탈로그 관리자가 나중에 값을 고쳐도 표시가 안 바뀐다(9장). planHistory는 최신순
  // 정렬이라 [0]이 그 스냅샷이다. 이력이 없는 경우(이 기능 배포 전 기존 행사)만 라이브 값으로
  // 대체한다 — 백엔드 계산 로직과 같은 폴백 원칙.
  const planSnapshot = planHistory[0];
  const plan = planSnapshot
    ? {
        name: planSnapshot.planName,
        supplyPrice: planSnapshot.planSupplyPrice,
        salePrice: planSnapshot.planSalePrice,
        discountType: planSnapshot.planDiscountType,
        discountValue: planSnapshot.planDiscountValue,
        maxSigners: planSnapshot.planMaxSigners,
        maxTemplates: planSnapshot.planMaxTemplates,
        maxTestEvents: planSnapshot.planMaxTestEvents,
        maxMainEvents: planSnapshot.planMaxMainEvents,
      }
    : (plans.find((p) => p.id === ceremony.billingPlanId) ?? null);

  return (
    <div>
      <Link to={detailPath} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        행사 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <Settings size={20} className="text-gray-400" />
          행사 수정
        </h1>
        <p className="mt-1 text-sm text-gray-500">{ceremony.title}</p>
        {isCompleted && (
          <p className="mt-1 text-xs text-gray-400">완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.</p>
        )}
      </div>

      {/* 행사 정보 수정 */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <FileSignature size={14} />
          행사 정보
        </h2>
        {isCompleted ? (
          <p className="text-sm text-gray-400">완료된 행사는 이름/설명을 수정할 수 없습니다.</p>
        ) : (
          <form onSubmit={handleUpdateCeremony} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">행사명</label>
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={isSavingInfo}
                className={infoInputClass}
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-gray-500 mb-1">행사 상태</span>
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${CEREMONY_STATUS_COLOR[ceremony.status]}`}
              >
                {CEREMONY_STATUS_LABEL[ceremony.status]}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">행사 주관 기관</label>
                <input
                  type="text"
                  value={organizingInstitutionDraft}
                  onChange={(e) => setOrganizingInstitutionDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">행사 주관 부서</label>
                <input
                  type="text"
                  value={organizingDepartmentDraft}
                  onChange={(e) => setOrganizingDepartmentDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당자명</label>
                <input
                  type="text"
                  value={contactNameDraft}
                  onChange={(e) => setContactNameDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당자 직위</label>
                <input
                  type="text"
                  value={contactTitleDraft}
                  onChange={(e) => setContactTitleDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당자 전화번호</label>
                <input
                  type="tel"
                  value={contactPhoneDraft}
                  onChange={(e) => setContactPhoneDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당자 이메일</label>
                <input
                  type="email"
                  value={contactEmailDraft}
                  onChange={(e) => setContactEmailDraft(e.target.value)}
                  disabled={isSavingInfo}
                  placeholder="선택 입력"
                  className={infoInputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">행사 설명</label>
              <textarea
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                disabled={isSavingInfo}
                rows={3}
                placeholder="선택 입력"
                className={`${infoInputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingInfo}
              className="px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isSavingInfo ? '저장 중...' : '저장'}
            </button>
          </form>
        )}
      </section>

      {/* 선택한 플랜 — 확정 전(DRAFT)에만 바꿀 수 있고, 확정 후엔 읽기 전용이다 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Info size={14} />
            선택한 플랜
          </h2>
          {!isPlanHistoryLoading && planHistory.length > 0 && (
            <button
              onClick={() => setIsPlanHistoryModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
            >
              <History size={12} />
              변경 이력 ({planHistory.length})
            </button>
          )}
        </div>

        {isDraft && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">
              아직 플랜 확정 전입니다. 확정해야 서명자/문서/하위 행사를 등록할 수 있습니다.
            </p>
            <button
              onClick={handleConfirmPlan}
              disabled={isConfirmingPlan}
              className="flex shrink-0 items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              <CheckCircle2 size={13} />
              {isConfirmingPlan ? '확정 중...' : '플랜 확정'}
            </button>
          </div>
        )}

        {isPlansLoading || isPlanHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !plan ? (
          <p className="text-sm text-gray-500">플랜 정보를 찾을 수 없습니다(#{ceremony.billingPlanId}).</p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">플랜명</span>
              <span className="text-gray-950 font-medium">{plan.name}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">공급가/판매가</span>
              <span className="text-gray-950">
                {formatPrice(plan.supplyPrice)} / {formatPrice(plan.salePrice)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">할인</span>
              <span className="text-gray-950">{formatDiscount(plan.discountType, plan.discountValue)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">서명자 한도</span>
              <span className="text-gray-950">{plan.maxSigners}명</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">템플릿 한도</span>
              <span className="text-gray-950">{plan.maxTemplates}건</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">테스트 행사 한도</span>
              <span className="text-gray-950">{plan.maxTestEvents}건</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">본행사 한도</span>
              <span className="text-gray-950">{plan.maxMainEvents}건</span>
            </div>
          </div>
        )}

        {isDraft && !isPlansLoading && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">다른 플랜으로 변경</label>
              <select
                value={selectedNewPlanId ?? ''}
                onChange={(e) => setSelectedNewPlanId(e.target.value ? Number(e.target.value) : null)}
                disabled={isChangingPlan}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                <option value="">선택</option>
                {plans
                  .filter((candidate) => candidate.id !== ceremony.billingPlanId && candidate.active)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} — {formatPrice(candidate.salePrice)}
                    </option>
                  ))}
              </select>
            </div>
            <button
              onClick={handleChangePlan}
              disabled={isChangingPlan || !selectedNewPlanId}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              <RefreshCw size={13} />
              {isChangingPlan ? '변경 중...' : '플랜 변경'}
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {isDraft ? '플랜 확정 전까지는 자유롭게 바꿀 수 있습니다.' : '플랜이 확정되어 더 이상 바꿀 수 없습니다.'}
        </p>
      </section>

      {/* 예상 청구 금액 — 품목 할인 → subtotal → 행사 건별 할인의 2단 순차 차감(견적용, 실제 결제 기능은 아직 없음) */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <Receipt size={14} />
          예상 청구 금액
        </h2>
        {isEstimatedTotalLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !estimatedTotal ? (
          <p className="text-sm text-gray-500">예상 청구 금액을 계산할 수 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">플랜</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.planAppliedPrice)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">용량 추가구매(승인분)</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.capacityPurchasesTotal)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">선택옵션 추가구매(승인분)</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.optionalFeaturePurchasesTotal)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">소계</span>
              <span className="text-gray-950 font-medium">{formatPrice(estimatedTotal.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">행사 건별 할인</span>
              <span className="text-gray-950">
                {estimatedTotal.finalDiscountValue > 0
                  ? `- ${formatDiscount(estimatedTotal.finalDiscountType, estimatedTotal.finalDiscountValue)}`
                  : '없음'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-950 font-bold">최종 금액</span>
              <span className="text-gray-950 font-bold">{formatPrice(estimatedTotal.finalTotal)}</span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          승인된 구매 건만 반영한 견적입니다. 행사 건별 할인은 플랫폼 관리자만 설정할 수 있고, 실제 결제/청구서 발행
          기능은 아직 없습니다.
        </p>
      </section>

      {/* 용량 추가구매 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <Package size={14} />
          용량 추가구매
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          요청하면 바로 반영되지 않습니다 — 플랫폼 관리자가 승인해야 유효 한도에 반영됩니다.
        </p>
        {isCapacityLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : isCompleted ? (
          <p className="text-sm text-gray-400">완료된 행사는 더 이상 추가구매할 수 없습니다.</p>
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
                {capacityAddOns
                  .filter((addOn) => addOn.active)
                  .map((addOn) => (
                    <option key={addOn.id} value={addOn.id}>
                      {CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType} +{addOn.unitAmount}
                      {addOn.secondaryCapacityType &&
                        ` · ${CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} +${addOn.secondaryUnitAmount}`}{' '}
                      — {formatPrice(addOn.salePrice)}
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
              {isPurchasingCapacity ? '요청 중...' : '구매 요청'}
            </button>
          </form>
        )}

        {isCapacityHistoryLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
          </div>
        ) : capacityPurchases.length > 0 ? (
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {capacityPurchases.map((purchase) => {
              const addOn = capacityAddOns.find((item) => item.id === purchase.capacityAddOnId);
              return (
                <li key={purchase.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-950">
                      {addOn ? CAPACITY_TYPE_LABEL[addOn.capacityType] ?? addOn.capacityType : `#${purchase.capacityAddOnId}`} +
                      {purchase.purchasedUnitAmount * purchase.quantity}
                      {addOn?.secondaryCapacityType && purchase.purchasedSecondaryUnitAmount != null && (
                        <>
                          {' · '}
                          {CAPACITY_TYPE_LABEL[addOn.secondaryCapacityType] ?? addOn.secondaryCapacityType} +
                          {purchase.purchasedSecondaryUnitAmount * purchase.quantity}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(purchase.createdAt).toLocaleString('ko-KR')}</p>
                    {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                      <p className="mt-0.5 text-xs text-red-600">{purchase.rejectionReason}</p>
                    )}
                  </div>
                  <PurchaseStatusBadge status={purchase.status} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">아직 요청한 용량 추가구매가 없습니다.</p>
        )}
      </section>

      {/* 선택옵션 추가구매 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <Sparkles size={14} />
            선택옵션 추가구매
          </h2>
          {!isFeatureHistoryLoading && featurePurchases.length > 0 && (
            <button
              onClick={() => setIsFeatureHistoryModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-400 hover:text-gray-950"
            >
              <History size={12} />
              이력 보기 ({featurePurchases.length})
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          요청하면 바로 반영되지 않습니다 — 플랫폼 관리자가 승인해야 하위 행사에 적용할 수 있습니다. 이미 요청했거나
          승인된 옵션은 아래 목록에 상태 뱃지로 표시되고, 지난 요청 이력은 "이력 보기"에서 따로 확인할 수 있습니다.
        </p>
        {isFeaturesLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : isCompleted ? (
          <p className="text-sm text-gray-400">완료된 행사는 더 이상 추가구매할 수 없습니다.</p>
        ) : optionalFeatures.filter((feature) => feature.active || hasActiveFeaturePurchase(feature.id)).length === 0 ? (
          <p className="text-sm text-gray-500">구매 가능한 선택옵션이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {/* 사용 중지된 옵션은 이미 구매(요청)한 게 있을 때만 상태 확인용으로 계속 보여준다. */}
            {optionalFeatures
              .filter((feature) => feature.active || hasActiveFeaturePurchase(feature.id))
              .map((feature) => (
              <li key={feature.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-gray-950">{feature.name}</p>
                  <p className="text-xs text-gray-500">{formatPrice(feature.salePrice)}</p>
                </div>
                {hasActiveFeaturePurchase(feature.id) ? (
                  <PurchaseStatusBadge
                    status={
                      featurePurchases.find((p) => p.optionalFeatureId === feature.id && p.status !== 'REJECTED')
                        ?.status ?? 'PENDING'
                    }
                  />
                ) : (
                  <button
                    onClick={() => handlePurchaseFeature(feature.id)}
                    disabled={processingFeatureId === feature.id}
                    className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                  >
                    {processingFeatureId === feature.id ? '요청 중...' : '구매 요청'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={isFeatureHistoryModalOpen}
        onClose={() => setIsFeatureHistoryModalOpen(false)}
        title="선택옵션 추가구매 이력"
        widthClassName="max-w-lg"
      >
        {featurePurchases.length === 0 ? (
          <p className="text-sm text-gray-400">아직 요청한 선택옵션 추가구매가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {featurePurchases.map((purchase) => {
              return (
                <li key={purchase.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    {/* 구매 시점 이름 스냅샷을 쓴다 — 카탈로그 이름이 나중에 바뀌어도 안 바뀐다(9장). */}
                    <p className="text-sm text-gray-950">{purchase.purchasedName}</p>
                    <p className="text-xs text-gray-400">{new Date(purchase.createdAt).toLocaleString('ko-KR')}</p>
                    {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                      <p className="mt-0.5 text-xs text-red-600">{purchase.rejectionReason}</p>
                    )}
                  </div>
                  <PurchaseStatusBadge status={purchase.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Modal>

      <Modal
        open={isPlanHistoryModalOpen}
        onClose={() => setIsPlanHistoryModalOpen(false)}
        title="플랜 변경 이력"
        widthClassName="max-w-lg"
      >
        {planHistory.length === 0 ? (
          <p className="text-sm text-gray-400">플랜 변경 이력이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {planHistory.map((history) => (
              <li key={history.id} className="py-2">
                <p className="text-sm text-gray-950 font-medium">{history.planName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatPrice(history.planSalePrice)} · 서명자 {history.planMaxSigners}명 · 템플릿{' '}
                  {history.planMaxTemplates}건 · 테스트 {history.planMaxTestEvents}건 · 본행사{' '}
                  {history.planMaxMainEvents}건
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(history.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
};
