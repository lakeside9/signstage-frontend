import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  FileSignature,
  History,
  Info,
  Loader2,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { FormattedNumberInput } from '../components/FormattedNumberInput';
import { Modal } from '../components/Modal';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/internationalization';
import { UNIT_PRODUCT_CATEGORY_OPTIONS, UNIT_PRODUCT_TYPE_LABEL, planSubtotal } from './billingCatalog/constants';
import { CustomerQuoteSection } from './ceremony/CustomerQuoteSection';
import type {
  BillingPlanSummary,
  CartLineSummary,
  CeremonyPlanHistorySummary,
  CeremonyStatus,
  CeremonySummary,
  EstimatedTotal,
  PurchaseStatus,
  UnitProductPurchaseSummary,
  UnitProductSummary,
} from '../types';

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

const formatPrice = (value: number, currencyCode = 'KRW') => formatCurrency(value, currencyCode);
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
 * <p>"기본 정보"/"플랫폼 이용료" 2탭으로 나뉜다(2026-09-10, 사용자 요청 — signstage-docs
 * business/ceremony-registration-flow-and-billing-tab-separation-review.md). `?tab=billing`
 * 쿼리로 이 탭을 곧장 열 수 있다 — 행사 등록 직후(`UserCeremonyCreate.tsx`)가 이 방식으로
 * 진입한다(등록 시 플랜 선택이 더 이상 필수가 아니라, 등록 직후 바로 플랜을 고르게 안내한다).
 * "고객 견적" 탭(파트너→실고객, `CustomerQuoteSection.tsx`)은 별개다 — signstage-docs
 * business/partner-customer-quote-design-review.md 결정(2026-09-11). 탭 이름은 같은 날
 * "과금"/"고객 견적" → "플랫폼 이용료"/"고객 정산" → 다시 "고객 견적"으로 바뀌었다(둘 다
 * 사용자 요청).
 *
 * <p>플랜은 확정 전(DRAFT)에만 바꿀 수 있고, "플랜 확정"으로 DRAFT → IN_PROGRESS로 단방향
 * 전이하면 그때부터 바꿀 수 없다(signstage-docs business/ceremony-plan-confirmation-review.md).
 * 서명자/문서/하위 행사는 플랜 확정 후에만 등록할 수 있다. 플랜 변경 이력은 그 시점의
 * 이름/가격/한도 스냅샷까지 남는다. 플랜을 아직 한 번도 선택하지 않았으면(billingPlanId가
 * null) 확정할 수 없다 — 먼저 선택해야 한다. 선택했지만 아직 확정 전이면 "선택 해제"로
 * 다시 null로 되돌릴 수 있다(2026-09-11 사용자 요청, `DELETE .../plan`) — 변경 이력은
 * 남기지 않는다(DRAFT는 스냅샷을 어차피 안 쓰는 상태라 남길 실익이 없다).
 *
 * 추가구매는 장바구니형 2단계다(signstage-docs
 * business/unit-product-purchase-self-checkout-review.md 4·6장 결정, 2026-09-11) — "추가
 * 구매하기"(옛 "구매 요청")는 서버에 저장되는 장바구니에 담을 뿐이고, 장바구니의 "구매하기"를
 * 눌러야 실제 구매가 된다. 카탈로그는 시스템 사용료(ESSENTIAL/APPLICATION)만 남아 있다 —
 * 장비·인력(EQUIPMENT/PERSONNEL)은 "플랫폼 이용료" 흐름에서 완전히 분리됐다(같은 문서 8장,
 * "고객 견적" 탭에서 직접 입력). 담긴 줄이 전부 시스템 사용료면 "구매하기"를 누르는 즉시
 * 반영된다(자가-체크아웃, 관리자 승인 없음) — 그래서 "예상 이용료"였던 이름도 "플랫폼
 * 이용료"로 바뀌었다. 구매 이력은 요청자 본인이 볼 수 있는 이력이고, 대기중(PENDING)/
 * 승인됨(APPROVED)/반려됨(REJECTED) 상태를 그대로 보여준다.
 */
type EditTab = 'info' | 'billing' | 'customerQuote';

export const UserCeremonyEdit: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<EditTab>(searchParams.get('tab') === 'billing' ? 'billing' : 'info');

  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [plans, setPlans] = useState<BillingPlanSummary[]>([]);
  const [isPlansLoading, setIsPlansLoading] = useState(true);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState<number | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false);
  const [isClearingPlan, setIsClearingPlan] = useState(false);

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

  const [purchasableProducts, setPurchasableProducts] = useState<UnitProductSummary[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [cartQuantities, setCartQuantities] = useState<Record<number, number>>({});
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cart, setCart] = useState<CartLineSummary[]>([]);
  const [isCartLoading, setIsCartLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [purchases, setPurchases] = useState<UnitProductPurchaseSummary[]>([]);
  const [isPurchaseHistoryLoading, setIsPurchaseHistoryLoading] = useState(true);

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
          const message = err instanceof Error ? err.message : '예상 이용료를 불러오지 못했습니다.';
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
        // 전체 카탈로그가 아니라 이 행사의 플랜에서 구매 가능한(안 A 큐레이션) 상품만 받는다 —
        // 플랜에 없는 상품을 골라 제출한 뒤에야 거부당하는 UX를 피하기 위함이다(signstage-docs
        // business/optional-feature-display-scope-and-plan-capacity-addon-review.md 5.6절).
        const response = await api.get(`${basePath}/purchasable-unit-products`);
        if (!cancelled) {
          setPurchasableProducts(response.data as UnitProductSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '추가구매 가능한 단위 상품을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsProductsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  const fetchPurchases = async () => {
    const response = await api.get(`${basePath}/unit-product-purchases`);
    return response.data as UnitProductPurchaseSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPurchases();
        if (!cancelled) {
          setPurchases(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '추가구매 이력을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsPurchaseHistoryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const fetchCart = async () => {
    const response = await api.get(`${basePath}/unit-product-cart`);
    return response.data as CartLineSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchCart();
        if (!cancelled) {
          setCart(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '장바구니를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsCartLoading(false);
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

  /**
   * 같은 플랜을 다시 선택해도 막지 않는다(2026-09-11 사용자 요청) — 그 경우 플랜은 그대로고
   * 서버가 오늘 날짜로 스냅샷만 새로 찍어준다("가격 갱신"). 백엔드 `changePlan`은 원래도 같은
   * 플랜 ID를 막지 않았는데, 예전엔 드롭다운이 현재 플랜을 목록에서 빼버려서 이 방법 자체를
   * 쓸 수 없었다.
   */
  const handleChangePlan = async () => {
    if (!selectedNewPlanId) {
      showSnackbar('변경할 플랜을 선택해주세요.', 'error');
      return;
    }
    const isPriceRefresh = selectedNewPlanId === ceremony?.billingPlanId;

    setIsChangingPlan(true);
    try {
      const response = await api.put(`${basePath}/plan`, { billingPlanId: selectedNewPlanId });
      setCeremony(response.data as CeremonySummary);
      setSelectedNewPlanId(null);
      showSnackbar(isPriceRefresh ? '오늘 기준 가격으로 갱신했습니다.' : '플랜을 변경했습니다.', 'success');
      setPlanHistory(await fetchPlanHistory());
      setEstimatedTotal(await fetchEstimatedTotal());
    } catch (err) {
      const message = err instanceof Error ? err.message : (isPriceRefresh ? '가격 갱신에 실패했습니다.' : '플랜 변경에 실패했습니다.');
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

  const handleClearPlan = async () => {
    setIsClearingPlan(true);
    try {
      const response = await api.delete(`${basePath}/plan`);
      setCeremony(response.data as CeremonySummary);
      showSnackbar('플랜 선택을 해제했습니다.', 'success');
      setEstimatedTotal(await fetchEstimatedTotal());
    } catch (err) {
      const message = err instanceof Error ? err.message : '플랜 선택 해제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsClearingPlan(false);
    }
  };

  /**
   * `max` prop은 장식용이다(`FormattedNumberInput`은 `type="text"`라 브라우저가 강제하지
   * 않는다 — 그 컴포넌트 자체 주석 참고) — 그래서 실제 상한은 여기서 직접 자른다. 이벤트
   * 효과 묶음(토글형)은 0 또는 1만 의미가 있다(2026-09-11 사용자 지적).
   */
  const setCartQuantity = (unitProductId: number, next: number, isToggle: boolean) => {
    const clamped = isToggle ? Math.min(1, Math.max(0, next)) : Math.max(0, next);
    setCartQuantities((prev) => ({ ...prev, [unitProductId]: clamped }));
  };

  /**
   * "추가 구매하기"(옛 "구매 요청") — 아직 구매를 만들지 않는다. 여러 항목에 수량을 입력한 뒤
   * 한 번에 서버 장바구니에 담는다(signstage-docs
   * business/unit-product-purchase-self-checkout-review.md 4장 결정, 2026-09-11) — 같은
   * 항목을 다시 담으면 서버가 기존 줄의 수량에 합쳐준다. 순차로 보내야 마지막에 다시 불러오는
   * 장바구니 상태가 항상 정확하다(동시에 여러 줄을 upsert하면 응답 순서가 뒤섞일 수 있다).
   * 성공하면 "추가 구매" 팝업을 닫는다(2026-09-11 사용자 요청) — 담긴 내용은 "장바구니"
   * 팝업에서 이어서 확인한다.
   */
  const handleAddToCart = async (e: FormEvent) => {
    e.preventDefault();
    const lines = Object.entries(cartQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([unitProductId, quantity]) => ({ unitProductId: Number(unitProductId), quantity }));
    if (lines.length === 0) {
      showSnackbar('담을 항목의 수량을 입력해주세요.', 'error');
      return;
    }

    setIsAddingToCart(true);
    try {
      for (const line of lines) {
        await api.post(`${basePath}/unit-product-cart/items`, line);
      }
      showSnackbar('장바구니에 담았습니다.', 'success');
      setCartQuantities({});
      setCart(await fetchCart());
      setIsPurchaseModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '장바구니에 담는 데 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleUpdateCartLine = async (unitProductId: number, quantity: number) => {
    if (quantity < 1) return;
    try {
      const response = await api.put(`${basePath}/unit-product-cart/items/${unitProductId}`, { quantity });
      setCart(response.data as CartLineSummary[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '수량 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  const handleRemoveCartLine = async (unitProductId: number) => {
    try {
      const response = await api.delete(`${basePath}/unit-product-cart/items/${unitProductId}`);
      setCart(response.data as CartLineSummary[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '장바구니에서 빼는 데 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  /**
   * "구매하기" — 여기가 곧 "구매 확정" 시점이다. 서버가 장바구니를 그대로 읽어 구매를
   * 만든다(요청 바디 없음). 담긴 줄이 전부 시스템 사용료면 관리자 승인 없이 그 즉시
   * 반영된다(자가-체크아웃) — 성공하면 장바구니는 비워지고 구매 이력에 새 줄이 남는다.
   */
  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const response = await api.post(`${basePath}/unit-product-purchases`);
      const purchase = response.data as UnitProductPurchaseSummary;
      showSnackbar(
        purchase.status === 'APPROVED' ? '구매가 즉시 반영됐습니다.' : '구매를 요청했습니다. 플랫폼 관리자 승인 후 반영됩니다.',
        'success',
      );
      setCart([]);
      setPurchases(await fetchPurchases());
      setEstimatedTotal(await fetchEstimatedTotal());
    } catch (err) {
      const message = err instanceof Error ? err.message : '구매에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsPurchasing(false);
    }
  };

  /**
   * 이벤트 효과 묶음(EVENT_EFFECT_BUNDLE)은 토글형이라 PENDING/APPROVED 요청이 있으면 재구매를
   * 막는다(백엔드 검증과 같은 규칙, 3.6절) — REJECTED는 재요청할 수 있어야 하므로 제외한다.
   * 그 외 종류(용량 계열)는 여러 번 구매해 누적할 수 있어 막지 않는다.
   */
  const activePurchaseStatus = (unitProductId: number): PurchaseStatus | undefined =>
    purchases.find(
      (purchase) => purchase.status !== 'REJECTED' && purchase.lines.some((line) => line.unitProductId === unitProductId),
    )?.status;
  const hasActiveEventEffectPurchase = (unitProductId: number) => activePurchaseStatus(unitProductId) !== undefined;

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
  // 추가구매 후보를 장비/인력/애플리케이션(+필수) 카테고리별로 묶어 보여준다 — AdminBillingSimulator.tsx의
  // groupedPurchasable과 같은 패턴이다(billing-catalog-unit-product-model-redesign-review.md §9,
  // 원래도 범위 밖으로 명시했던 "구매 화면 카테고리별 재구성" 후속 작업).
  const purchasableInCeremony = purchasableProducts.filter((p) => p.active || hasActiveEventEffectPurchase(p.id));
  const groupedPurchasable = UNIT_PRODUCT_CATEGORY_OPTIONS.map((option) => ({
    category: option.label,
    items: purchasableInCeremony.filter((p) => p.category === option.value),
  })).filter(({ items }) => items.length > 0);
  // "선택한 플랜" 표시 — 확정 후(IN_PROGRESS)엔 확정(또는 가장 최근 변경) 시점 스냅샷을 쓴다
  // (카탈로그 관리자가 나중에 값을 고쳐도 표시가 안 바뀐다, 9장). planHistory는 최신순 정렬이라
  // [0]이 그 스냅샷이다.
  //
  // DRAFT 동안은 반대로 라이브 카탈로그 값을 우선 쓴다(2026-09-11 사용자 요청 — signstage-docs
  // business/ceremony-plan-price-snapshot-consistency-review.md 3.4절) — 바로 아래 "플랫폼
  // 이용료" 섹션이 DRAFT 동안 라이브로 재계산되는 것과 기준을 맞춘다. "아직 확정 안 된, 계속
  // 바뀔 수 있는 상태"라는 DRAFT의 원칙과도 일치한다. 라이브 카탈로그에서 플랜을 못 찾으면
  // (예: 배포 전 기존 행사라 이력 자체가 없는 경우) 스냅샷으로 대체한다.
  const planSnapshot = planHistory[0];
  const livePlan = plans.find((p) => p.id === ceremony.billingPlanId);
  const planFromSnapshot = planSnapshot && {
    name: planSnapshot.planName,
    discountType: planSnapshot.planDiscountType,
    discountValue: planSnapshot.planDiscountValue,
    currencyCode: planSnapshot.lines[0]?.currencyCode ?? 'KRW',
    subtotal: planSnapshot.lines.reduce((sum, line) => sum + line.snapshotSalePrice * line.includedQuantity, 0),
    includedQuantityOf: (type: string) =>
      planSnapshot.lines.find((line) => line.unitProductType === type)?.includedQuantity ?? 0,
  };
  const planFromLive = livePlan && {
    name: livePlan.name,
    discountType: livePlan.discountType,
    discountValue: livePlan.discountValue,
    currencyCode: livePlan.unitProducts[0]?.currencyCode ?? 'KRW',
    subtotal: planSubtotal(livePlan.unitProducts),
    includedQuantityOf: (type: string) =>
      livePlan.unitProducts.find((line) => line.unitProductType === type)?.includedQuantity ?? 0,
  };
  const plan = isDraft ? (planFromLive ?? planFromSnapshot ?? null) : (planFromSnapshot ?? planFromLive ?? null);

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

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {(
          [
            { value: 'info', label: '기본 정보', icon: FileSignature },
            { value: 'billing', label: '플랫폼 이용료', icon: CreditCard },
            { value: 'customerQuote', label: '고객 견적', icon: Banknote },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 min-w-28 justify-center px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                isActive ? 'bg-gray-950 text-white' : 'text-gray-500 hover:text-gray-950'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.value === 'billing' && isDraft && !ceremony.billingPlanId && (
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-amber-300' : 'bg-amber-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* 행사 정보 수정 */}
      <section hidden={activeTab !== 'info'} className="bg-white border border-gray-200 rounded-lg p-4">
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

      <div hidden={activeTab !== 'billing'}>
      {/* 선택한 플랜 — 확정 전(DRAFT)에만 바꿀 수 있고, 확정 후엔 읽기 전용이다 */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
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

        {isDraft && !ceremony.billingPlanId && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">아직 플랜을 선택하지 않았습니다. 아래에서 플랜을 선택해주세요.</p>
          </div>
        )}

        {isDraft && ceremony.billingPlanId && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">
              아직 플랜 확정 전입니다. 확정해야 서명자/문서/하위 행사를 등록할 수 있습니다.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleClearPlan}
                disabled={isClearingPlan || isConfirmingPlan}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                {isClearingPlan ? '해제 중...' : '선택 해제'}
              </button>
              <button
                onClick={handleConfirmPlan}
                disabled={isConfirmingPlan || isClearingPlan}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <CheckCircle2 size={13} />
                {isConfirmingPlan ? '확정 중...' : '플랜 확정'}
              </button>
            </div>
          </div>
        )}

        {isPlansLoading || isPlanHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !plan ? (
          <p className="text-sm text-gray-500">
            {ceremony.billingPlanId ? `플랜 정보를 찾을 수 없습니다(#${ceremony.billingPlanId}).` : '아직 선택한 플랜이 없습니다.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">플랜명</span>
              <span className="text-gray-950 font-medium">{plan.name}</span>
            </div>
            {/* 공급가(원가)는 내부 전용이라 사용자 화면에 노출하지 않는다(signstage-docs
                business/billing-catalog-operations-review.md 4장). 플랜은 자기 가격이 없다 —
                포함 단위 상품 소계로 대신 보여준다(signstage-docs
                business/billing-catalog-unit-product-model-redesign-review.md 결정,
                2026-09-10). */}
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">단위 상품 소계</span>
              <span className="text-gray-950">{formatPrice(plan.subtotal, plan.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">할인</span>
              <span className="text-gray-950">
                {plan.discountType === null || plan.discountValue === null ? '-' : formatDiscount(plan.discountType, plan.discountValue)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-950 font-bold">서명자 한도</span>
              <span className="text-gray-950 font-bold">{plan.includedQuantityOf('SIGNERS')}명</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">템플릿 한도</span>
              <span className="text-gray-950">{plan.includedQuantityOf('TEMPLATES')}건</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">테스트 행사 한도</span>
              <span className="text-gray-950">{plan.includedQuantityOf('TEST_EVENTS')}건</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">리허설 행사 한도</span>
              <span className="text-gray-950">{plan.includedQuantityOf('REHEARSAL_EVENTS')}건</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">본행사 한도</span>
              <span className="text-gray-950">{plan.includedQuantityOf('MAIN_EVENTS')}건</span>
            </div>
          </div>
        )}

        {isDraft && !isPlansLoading && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {ceremony.billingPlanId ? '다른 플랜으로 변경 / 가격 갱신' : '플랜 선택'}
              </label>
              {/* 현재 플랜도 목록에 남겨둔다(2026-09-11 사용자 요청) — 그대로 다시 선택하면
                  플랜은 안 바뀌고 스냅샷만 "오늘" 기준으로 새로 찍힌다("가격 갱신"). 할인
                  기간이 새로 시작된 뒤 최신가를 반영하고 싶을 때 유일한 방법이라, 예전처럼
                  드롭다운에서 빼두면 이 방법 자체를 알 길이 없었다. */}
              <select
                value={selectedNewPlanId ?? ''}
                onChange={(e) => setSelectedNewPlanId(e.target.value ? Number(e.target.value) : null)}
                disabled={isChangingPlan}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                <option value="">선택</option>
                {plans
                  .filter((candidate) => candidate.id === ceremony.billingPlanId || candidate.active)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                      {candidate.id === ceremony.billingPlanId ? ' (현재 플랜)' : ''}
                      {candidate.unitProducts.length === 0
                        ? ''
                        : ` — ${formatPrice(planSubtotal(candidate.unitProducts), candidate.unitProducts[0]?.currencyCode ?? 'KRW')}`}
                    </option>
                  ))}
              </select>
            </div>
            <button
              onClick={handleChangePlan}
              disabled={isChangingPlan || !selectedNewPlanId}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              <Check size={13} />
              {isChangingPlan
                ? '처리 중...'
                : selectedNewPlanId === ceremony.billingPlanId
                  ? '가격 갱신'
                  : ceremony.billingPlanId
                    ? '플랜 변경'
                    : '플랜 선택'}
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {isDraft ? '플랜 확정 전까지는 자유롭게 바꿀 수 있습니다.' : '플랜이 확정되어 더 이상 바꿀 수 없습니다.'}
        </p>

        {/* 플랜이 확정된 후에만 단위 상품을 추가구매할 수 있다(2026-09-11 사용자 요청) —
            그래서 이 버튼 두 개도 확정 후에만 여기(선택한 플랜 하단)에 나타난다. */}
        {!isDraft && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
            <button
              onClick={() => setIsPurchaseModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
            >
              <Package size={13} />
              추가 구매
            </button>
            <button
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
            >
              <ShoppingCart size={13} />
              장바구니
              {!isCartLoading && cart.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-gray-950 text-white text-[10px] font-bold">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        )}
      </section>

      {/* 구매 이력 — 옛 "확정 이용료"(BillingQuote) 섹션을 대체한다. 자가-체크아웃이 들어오면서
          "지금 이 순간의 합계를 한 번 더 얼려두는" 그 기능의 존재 이유가 옅어졌다 — 각 구매 줄이
          이미 구매 시점 스냅샷을 갖고 있어 이 이력만으로 "그때 얼마였는지"를 충분히 보여준다
          (signstage-docs business/unit-product-purchase-self-checkout-review.md 4.3절). 모달이
          아니라 상시 노출되는 자리로 승격했다. "선택한 플랜" 바로 아래에 둔다(2026-09-11 사용자
          요청). */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <History size={14} />
          구매 이력
        </h2>
        {isPurchaseHistoryLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <p className="text-sm text-gray-500">아직 구매한 이력이 없습니다.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {purchases.map((purchase) => {
                // 구매 시점 이름/수량/단가 스냅샷을 쓴다 — 카탈로그 값이 나중에 바뀌어도 안 바뀐다(9장).
                const purchaseAmount = purchase.lines.reduce(
                  (sum, line) => sum + line.purchasedSalePrice * line.quantity, 0,
                );
                return (
                  <li key={purchase.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-gray-950">
                        {purchase.lines.map((line) => `${line.purchasedName} × ${line.quantity}`).join(', ')}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTime(purchase.createdAt)}</p>
                      {purchase.status === 'REJECTED' && purchase.rejectionReason && (
                        <p className="mt-0.5 text-xs text-red-600">{purchase.rejectionReason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-medium text-gray-950">
                        {formatPrice(purchaseAmount, purchase.lines[0]?.currencyCode ?? ceremony.currencyCode)}
                      </span>
                      <PurchaseStatusBadge status={purchase.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
              <span className="text-xs font-bold text-gray-700">
                합계 <span className="font-normal text-gray-400">(승인된 구매만)</span>
              </span>
              <span className="text-sm font-bold text-gray-950">
                {formatPrice(
                  purchases
                    .filter((purchase) => purchase.status === 'APPROVED')
                    .reduce(
                      (total, purchase) =>
                        total + purchase.lines.reduce((sum, line) => sum + line.purchasedSalePrice * line.quantity, 0),
                      0,
                    ),
                  ceremony.currencyCode,
                )}
              </span>
            </div>
          </>
        )}
      </section>

      {/* 플랫폼 이용료(옛 "예상 이용료") — 품목 할인 → subtotal → 행사 건별 할인의 2단 순차
          차감. 자가-체크아웃 도입으로 시스템 사용료는 "구매하기"를 누르는 즉시 확정 반영되므로
          더는 잠정치가 아니라 지금 시점의 실제 값에 가깝다(signstage-docs
          business/unit-product-purchase-self-checkout-review.md 4.2절). */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5 mb-3">
          <Receipt size={14} />
          플랫폼 이용료
        </h2>
        {!ceremony.billingPlanId ? (
          <p className="text-sm text-gray-500">플랜을 선택하면 플랫폼 이용료를 볼 수 있습니다.</p>
        ) : isEstimatedTotalLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !estimatedTotal ? (
          <p className="text-sm text-gray-500">플랫폼 이용료를 계산할 수 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">플랜</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.planAppliedPrice, estimatedTotal.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">추가구매(승인분)</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.unitProductPurchasesTotal, estimatedTotal.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">소계</span>
              <span className="text-gray-950 font-medium">{formatPrice(estimatedTotal.subtotal, estimatedTotal.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">행사 건별 할인</span>
              <span className="text-gray-950">
                {estimatedTotal.finalDiscountValue > 0
                  ? `- ${formatDiscount(estimatedTotal.finalDiscountType, estimatedTotal.finalDiscountValue)}`
                  : '없음'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">공급가액</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.netAmount, estimatedTotal.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">부가세</span>
              <span className="text-gray-950">{formatPrice(estimatedTotal.taxAmount, estimatedTotal.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-950 font-bold">최종 금액(부가세 포함)</span>
              <span className="text-gray-950 font-bold">{formatPrice(estimatedTotal.grossAmount, estimatedTotal.currencyCode)}</span>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          승인된 구매 건만 반영한 예상 금액입니다. 행사 건별 할인은 플랫폼 관리자만 설정할 수 있고, 실제 결제/청구서 발행
          기능은 아직 없습니다.
        </p>
      </section>

      </div>

      {/* 추가 구매 팝업 — 장바구니형 2단계(signstage-docs
          business/unit-product-purchase-self-checkout-review.md 4장 결정, 2026-09-11):
          "추가 구매하기"는 서버 장바구니에 담을 뿐이고, 장바구니의 "구매하기"가 곧 구매 확정
          시점이다. 카탈로그는 시스템 사용료(ESSENTIAL/APPLICATION)만 온다 — 장비·인력은
          "고객 견적" 탭에서 직접 입력한다. "선택한 플랜" 하단 버튼으로 여는 팝업이라 플랜이
          확정된(!isDraft) 행사에서만 열 수 있다(2026-09-11 사용자 요청). */}
      <Modal open={isPurchaseModalOpen} onClose={() => setIsPurchaseModalOpen(false)} title="추가 구매" widthClassName="max-w-lg">
        <p className="text-xs text-gray-400 mb-3">
          수량을 입력하고 장바구니에 담으세요 — 여러 항목을 함께 담을 수 있습니다. 장바구니에
          담긴 것만으로는 아직 구매가 아닙니다 — 장바구니 팝업에서 "구매하기"를 눌러야 확정됩니다.
        </p>
        {isProductsLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : isCompleted ? (
          <p className="text-sm text-gray-400">완료된 행사는 더 이상 추가구매할 수 없습니다.</p>
        ) : purchasableInCeremony.length === 0 ? (
          <p className="text-sm text-gray-500">추가구매 가능한 단위 상품이 없습니다.</p>
        ) : (
          <form onSubmit={handleAddToCart} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* 사용 중지된 상품은 이미 요청(대기중/승인)한 이벤트 효과 묶음일 때만 상태 확인용으로 계속 보여준다. */}
            {groupedPurchasable.map(({ category, items }) => (
              <div key={category}>
                <h3 className="text-xs font-bold text-gray-500 mb-1.5">{category}</h3>
                <div className="space-y-1.5">
                  {items.map((product) => {
                    const isEventEffectBundle = product.type === 'EVENT_EFFECT_BUNDLE';
                    const blocked = isEventEffectBundle && hasActiveEventEffectPurchase(product.id);
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 border border-gray-200 rounded-md px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-950">
                            {product.name}
                            {!product.active && <span className="ml-2 text-xs text-gray-400">사용 중지</span>}
                          </p>
                          <p className="text-xs text-gray-500">
                            {UNIT_PRODUCT_TYPE_LABEL[product.type] ?? product.type} ·{' '}
                            {product.salePrice === null ? '가격 정보 없음' : formatPrice(product.salePrice, product.currencyCode ?? 'KRW')}
                          </p>
                          {product.description && <p className="text-xs text-gray-400 mt-0.5">{product.description}</p>}
                        </div>
                        {blocked ? (
                          <PurchaseStatusBadge status={activePurchaseStatus(product.id) ?? 'PENDING'} />
                        ) : (
                          <FormattedNumberInput
                            min={0}
                            max={isEventEffectBundle ? 1 : undefined}
                            value={cartQuantities[product.id] || ''}
                            onChange={(raw) => setCartQuantity(product.id, Number(raw), isEventEffectBundle)}
                            disabled={isAddingToCart}
                            placeholder="0"
                            className="w-16 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCartQuantities({});
                  setIsPurchaseModalOpen(false);
                }}
                disabled={isAddingToCart}
                className="px-4 py-1.5 rounded-md text-gray-500 text-xs font-medium hover:text-gray-950 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isAddingToCart}
                className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                {isAddingToCart ? '담는 중...' : '추가 구매하기'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* 장바구니 팝업 — 서버에 저장돼 새로고침·탭 전환에도 유지된다(6장 결정). */}
      <Modal open={isCartModalOpen} onClose={() => setIsCartModalOpen(false)} title="장바구니" widthClassName="max-w-lg">
        {isCartLoading ? (
          <div className="flex items-center justify-center py-4 text-gray-400">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : cart.length === 0 ? (
          <p className="text-sm text-gray-400">담긴 항목이 없습니다.</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {cart.map((line) => (
                <li key={line.unitProductId} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-950">{line.unitProduct.name}</p>
                    <p className="text-xs text-gray-500">
                      {line.unitProduct.salePrice === null
                        ? '가격 정보 없음'
                        : formatPrice(line.unitProduct.salePrice, line.unitProduct.currencyCode ?? 'KRW')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <FormattedNumberInput
                      min={1}
                      // 이벤트 효과 묶음(토글형)은 행사당 1회만 담을 수 있다 — 전에는 여기서 수량을
                      // 2 이상으로 고쳐도 막지 않아 서버 거부(CEREMONY_UNIT_PRODUCT_TOGGLE_
                      // QUANTITY_INVALID)까지 가야 알 수 있었다(2026-09-11 사용자 지적). max는
                      // FormattedNumberInput에서 장식용이라(그 컴포넌트 주석 참고) onChange에서
                      // 직접 1로 자른다.
                      max={line.unitProduct.type === 'EVENT_EFFECT_BUNDLE' ? 1 : undefined}
                      value={line.quantity}
                      onChange={(raw) => {
                        const next = Number(raw);
                        const isEventEffectBundle = line.unitProduct.type === 'EVENT_EFFECT_BUNDLE';
                        handleUpdateCartLine(line.unitProductId, isEventEffectBundle ? Math.min(1, next) : next);
                      }}
                      className="w-16 px-2 py-1 border border-gray-200 rounded-md text-sm text-right focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
                    />
                    <button
                      onClick={() => handleRemoveCartLine(line.unitProductId)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label="빼기"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-end">
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {isPurchasing ? '구매하는 중...' : '구매하기'}
              </button>
            </div>
          </>
        )}
      </Modal>

      <div hidden={activeTab !== 'customerQuote'}>
        {organizationId && ceremonyId && (
          <CustomerQuoteSection organizationId={organizationId} ceremonyId={ceremonyId} isDraft={isDraft} />
        )}
      </div>

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
            {planHistory.map((history) => {
              const subtotal = history.lines.reduce((sum, line) => sum + line.snapshotSalePrice * line.includedQuantity, 0);
              const findQty = (type: string) => history.lines.find((line) => line.unitProductType === type)?.includedQuantity ?? 0;
              return (
                <li key={history.id} className="py-2">
                  <p className="text-sm text-gray-950 font-medium">{history.planName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatPrice(subtotal, history.lines[0]?.currencyCode ?? 'KRW')} · 서명자 {findQty('SIGNERS')}명 · 템플릿{' '}
                    {findQty('TEMPLATES')}건 · 테스트 {findQty('TEST_EVENTS')}건 · 본행사 {findQty('MAIN_EVENTS')}건
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(history.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
};
