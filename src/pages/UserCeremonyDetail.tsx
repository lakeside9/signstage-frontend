import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Settings,
  SquareCheckBig,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  BillingPlanSummary,
  CapacityStatus,
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  CeremonyStatus,
  CeremonySummary,
  OptionalFeatureSummary,
  SignerExcelUploadResult,
  SignerSummary,
  TemplateDocumentRole,
  TemplateStatus,
  TemplateSummary,
} from '../types';

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

/** LocalDateTime 문자열("2026-07-29T05:00:00")을 "2026-07-29 05:00"으로 자른다 — 타임존 변환 없이 그대로 보여준다. */
const formatEventDateTime = (value: string | null) => (value ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : null);

const formatEventSchedule = (event: CeremonyEventSummary) => {
  if (!event.scheduledStartAt && !event.scheduledEndAt) return '일정 미정';
  const start = formatEventDateTime(event.scheduledStartAt) ?? '미정';
  const end = formatEventDateTime(event.scheduledEndAt) ?? '미정';
  return `${start} ~ ${end}`;
};

/** <input type="datetime-local">에 바로 넣을 수 있게 앞 16자로 자른다("2026-07-29T05:00"). */
const toDateTimeLocalValue = (value: string | null) => (value ? value.slice(0, 16) : '');

const DOCUMENT_ROLE_LABEL: Record<TemplateDocumentRole, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };
/** 서명란 배치 화면에서 "설정 완료"를 눌러야 COMPLETED로 바뀐다 — 그 전까지는 DRAFT다. */
const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = { DRAFT: '설정 필요', COMPLETED: '설정 완료' };
const TEMPLATE_STATUS_COLOR: Record<TemplateStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** 백엔드가 플랜 없는 행사(레거시)에 대해 돌려주는 Integer.MAX_VALUE — "무제한"으로 표시한다. */
const UNLIMITED_CAPACITY = 2147483647;

/** 등록 화면 타이틀에 "등록 가능 N명/건" 형태로 붙일 때 쓴다 — 숫자만 덜렁 보이지 않게 단위를 함께 준다. */
const formatCapacity = (limit: number, unit: string) => (limit >= UNLIMITED_CAPACITY ? '무제한' : `${limit}${unit}`);

/**
 * 행사(Ceremony) 상세(`/org/ceremonies/:organizationId/:ceremonyId`). legacy 화면 구성을
 * 따라 서명자 관리 목록, 문서 양식 관리 목록, 하위 행사(이벤트) 목록을 이 화면 하나에 모두
 * 담는다(예전엔 `UserSignerList`/`UserTemplateList`로 화면이 따로 있었으나 여기로 흡수됐다 —
 * 문서 위 서명란 배치만 항목이 많고 복잡해 `UserTemplateDetail`로 계속 분리돼 있다). 조회
 * 중심 화면이라 행사 자체에 변화를 주는 조작(용량/선택옵션 추가구매)은 `UserCeremonyEdit`
 * (행사 수정 화면)로 분리했다. 섹션마다 독립적으로 불러오고 실패해도 서로 막지 않는다
 * (AdminOrganizationDetail과 같은 패턴).
 */
export const UserCeremonyDetail: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [ceremony, setCeremony] = useState<CeremonySummary | null>(null);
  const [plan, setPlan] = useState<BillingPlanSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [events, setEvents] = useState<CeremonyEventSummary[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [isEventsSectionOpen, setIsEventsSectionOpen] = useState(true);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [isSignersLoading, setIsSignersLoading] = useState(true);
  const [isSignersSectionOpen, setIsSignersSectionOpen] = useState(true);
  const [isSignerFormOpen, setIsSignerFormOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerPosition, setSignerPosition] = useState('');
  const [signerAffiliation, setSignerAffiliation] = useState('');
  const [isAddingSigner, setIsAddingSigner] = useState(false);
  const [isDownloadingSignerTemplate, setIsDownloadingSignerTemplate] = useState(false);
  const [isUploadingSignerExcel, setIsUploadingSignerExcel] = useState(false);
  const signerExcelInputRef = useRef<HTMLInputElement>(null);

  const [processingSignerId, setProcessingSignerId] = useState<number | null>(null);
  const [viewingSignerId, setViewingSignerId] = useState<number | null>(null);
  const [editingSignerId, setEditingSignerId] = useState<number | null>(null);
  const [editSignerName, setEditSignerName] = useState('');
  const [editSignerPosition, setEditSignerPosition] = useState('');
  const [editSignerAffiliation, setEditSignerAffiliation] = useState('');
  const [editSignerRoleCode, setEditSignerRoleCode] = useState('');
  const [deletingSignerId, setDeletingSignerId] = useState<number | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [isTemplatesSectionOpen, setIsTemplatesSectionOpen] = useState(true);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDocumentRole, setTemplateDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  const [processingTemplateId, setProcessingTemplateId] = useState<number | null>(null);
  const [viewingTemplateId, setViewingTemplateId] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState('');
  const [editTemplateDocumentRole, setEditTemplateDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);

  const [processingEventId, setProcessingEventId] = useState<number | null>(null);
  const [viewingEventId, setViewingEventId] = useState<number | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editEventName, setEditEventName] = useState('');
  const [editEventVenue, setEditEventVenue] = useState('');
  const [editEventScheduledStart, setEditEventScheduledStart] = useState('');
  const [editEventScheduledEnd, setEditEventScheduledEnd] = useState('');
  const [editEventDescription, setEditEventDescription] = useState('');
  const [editEventFeatureIds, setEditEventFeatureIds] = useState<number[]>([]);
  const [deletingEventId, setDeletingEventId] = useState<number | null>(null);

  // "하위 행사 수정" 모달의 적용 선택옵션 체크박스용 — 이 행사 마스터가 실제로 쓸 수 있는
  // (플랜 포함분 + 승인된 추가구매) 목록만 걸러서 보여준다(등록 화면과 같은 엔드포인트).
  const [availableEventFeatures, setAvailableEventFeatures] = useState<OptionalFeatureSummary[]>([]);

  // 서명자/문서 양식/하위 행사 섹션 타이틀에 "등록할 수 있는 개수"를 보여주는 데 쓴다
  // (플랜 기본값 + 승인된 추가구매 반영). 못 불러와도 개수 안내만 빠질 뿐이라 조용히 넘어간다.
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | null>(null);

  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;
  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(basePath);
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

  const fetchEvents = async () => {
    const response = await api.get(`${basePath}/events`);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`${basePath}/available-optional-features`);
        if (!cancelled) {
          setAvailableEventFeatures(response.data as OptionalFeatureSummary[]);
        }
      } catch {
        // 수정 모달을 아직 안 열었을 수도 있어 조용히 넘어간다 — 모달을 열 때 목록이 비어
        // 있으면 "적용할 수 있는 선택옵션이 없습니다"로 보이는 것으로 충분하다.
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
        const response = await api.get(`${basePath}/capacity-status`);
        if (!cancelled) {
          setCapacityStatus(response.data as CapacityStatus);
        }
      } catch {
        // 섹션 타이틀의 "등록 가능" 안내만 빠질 뿐이라 조회 자체를 막지 않는다.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const startEditEvent = (event: CeremonyEventSummary) => {
    setViewingEventId(null);
    setDeletingEventId(null);
    setEditingEventId(event.id);
    setEditEventName(event.name);
    setEditEventVenue(event.venue ?? '');
    setEditEventScheduledStart(toDateTimeLocalValue(event.scheduledStartAt));
    setEditEventScheduledEnd(toDateTimeLocalValue(event.scheduledEndAt));
    setEditEventDescription(event.description ?? '');
    setEditEventFeatureIds(event.optionalFeatureIds);
  };

  /**
   * exclusivityGroup이 있는 옵션을 고르면 같은 그룹의 다른 선택을 자동 해제한다 — 라디오
   * 버튼처럼. `UserCeremonyEventCreate.tsx`의 toggleFeature와 같은 이유·같은 로직이다.
   */
  const toggleEditEventFeature = (featureId: number) => {
    setEditEventFeatureIds((prev) => {
      if (prev.includes(featureId)) {
        return prev.filter((id) => id !== featureId);
      }
      const group = availableEventFeatures.find((f) => f.id === featureId)?.exclusivityGroup ?? null;
      const withoutGroupSiblings = group
        ? prev.filter((id) => availableEventFeatures.find((f) => f.id === id)?.exclusivityGroup !== group)
        : prev;
      return [...withoutGroupSiblings, featureId];
    });
  };

  const handleSaveEventEdit = async (eventId: number) => {
    if (!editEventName.trim()) {
      showSnackbar('하위 행사 이름을 입력해주세요.', 'error');
      return;
    }
    setProcessingEventId(eventId);
    try {
      await api.put(`${basePath}/events/${eventId}`, {
        name: editEventName.trim(),
        venue: editEventVenue.trim() || null,
        scheduledStartAt: editEventScheduledStart || null,
        scheduledEndAt: editEventScheduledEnd || null,
        description: editEventDescription.trim() || null,
        optionalFeatureIds: editEventFeatureIds,
      });
      showSnackbar('하위 행사를 저장했습니다.', 'success');
      setEditingEventId(null);
      setEvents(await fetchEvents());
    } catch (err) {
      const message = err instanceof Error ? err.message : '하위 행사 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingEventId(null);
    }
  };

  const openDeleteEvent = (eventId: number) => {
    setViewingEventId(null);
    setEditingEventId(null);
    setDeletingEventId(eventId);
  };

  const handleDeleteEvent = async (eventId: number) => {
    setProcessingEventId(eventId);
    try {
      await api.delete(`${basePath}/events/${eventId}`);
      showSnackbar('하위 행사를 삭제했습니다.', 'success');
      setDeletingEventId(null);
      setEvents(await fetchEvents());
    } catch (err) {
      const message = err instanceof Error ? err.message : '하위 행사 삭제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingEventId(null);
    }
  };

  const fetchSigners = async () => {
    const response = await api.get(`${basePath}/signers`);
    return response.data as SignerSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchSigners();
        if (!cancelled) {
          setSigners(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '서명자 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsSignersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const fetchTemplates = async () => {
    const response = await api.get(`${basePath}/templates`);
    return response.data as TemplateSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchTemplates();
        if (!cancelled) {
          setTemplates(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '문서 양식 목록을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsTemplatesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const handleAddSigner = async (e: FormEvent) => {
    e.preventDefault();
    if (!signerName.trim()) {
      showSnackbar('서명자 이름을 입력해주세요.', 'error');
      return;
    }

    setIsAddingSigner(true);
    try {
      await api.post(`${basePath}/signers`, {
        name: signerName.trim(),
        position: signerPosition.trim() || null,
        affiliation: signerAffiliation.trim() || null,
        // 역할 코드는 등록 화면에 노출하지 않는다 — 필요하면 등록 후 수정 화면에서 채운다.
        roleCode: null,
      });
      showSnackbar('서명자를 등록했습니다.', 'success');
      setSignerName('');
      setSignerPosition('');
      setSignerAffiliation('');
      setIsSignerFormOpen(false);
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명자 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsAddingSigner(false);
    }
  };

  const handleDownloadSignerExcelTemplate = async () => {
    setIsDownloadingSignerTemplate(true);
    try {
      const blob = await api.getBlob(`${basePath}/signers/excel-template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '서명자_업로드_양식.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '엑셀 양식을 내려받지 못했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsDownloadingSignerTemplate(false);
    }
  };

  /** 열 순서(이름/소속/직위)는 handleDownloadSignerExcelTemplate로 받은 양식과 같다. */
  const handleUploadSignerExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSignerExcel(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`${basePath}/signers/excel-upload`, formData);
      const result = response.data as SignerExcelUploadResult;

      if (result.skippedRows.length === 0) {
        showSnackbar(`서명자 ${result.createdSigners.length}명을 등록했습니다.`, 'success');
      } else {
        const skippedSummary = result.skippedRows.map((row) => `${row.rowNumber}행(${row.reason})`).join(', ');
        showSnackbar(
          `서명자 ${result.createdSigners.length}명을 등록했습니다. 건너뜀: ${skippedSummary}`,
          result.createdSigners.length > 0 ? 'success' : 'error',
        );
      }
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '엑셀 업로드에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsUploadingSignerExcel(false);
      if (signerExcelInputRef.current) signerExcelInputRef.current.value = '';
    }
  };

  const startEditSigner = (signer: SignerSummary) => {
    setViewingSignerId(null);
    setDeletingSignerId(null);
    setEditingSignerId(signer.id);
    setEditSignerName(signer.name);
    setEditSignerPosition(signer.position ?? '');
    setEditSignerAffiliation(signer.affiliation ?? '');
    setEditSignerRoleCode(signer.roleCode ?? '');
  };

  const handleSaveSignerEdit = async (signerId: number) => {
    if (!editSignerName.trim()) {
      showSnackbar('서명자 이름을 입력해주세요.', 'error');
      return;
    }
    setProcessingSignerId(signerId);
    try {
      await api.put(`${basePath}/signers/${signerId}`, {
        name: editSignerName.trim(),
        position: editSignerPosition.trim() || null,
        affiliation: editSignerAffiliation.trim() || null,
        roleCode: editSignerRoleCode.trim() || null,
      });
      showSnackbar('서명자를 저장했습니다.', 'success');
      setEditingSignerId(null);
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명자 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingSignerId(null);
    }
  };

  const openDeleteSigner = (signerId: number) => {
    setViewingSignerId(null);
    setEditingSignerId(null);
    setDeletingSignerId(signerId);
  };

  const handleDeleteSigner = async (signerId: number) => {
    setProcessingSignerId(signerId);
    try {
      await api.delete(`${basePath}/signers/${signerId}`);
      showSnackbar('서명자를 삭제했습니다.', 'success');
      setDeletingSignerId(null);
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명자 삭제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingSignerId(null);
    }
  };

  const handleTemplateFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== 'application/pdf') {
      showSnackbar('PDF 파일만 업로드할 수 있습니다.', 'error');
      e.target.value = '';
      setTemplateFile(null);
      return;
    }
    setTemplateFile(selected);
    // 파일을 고르면 확장자를 뺀 파일명을 제목에 자동으로 채운다 — 등록자가 그대로 두거나
    // 이어서 직접 수정할 수 있다(강제 아님).
    if (selected) {
      setTemplateTitle(selected.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleUploadTemplate = async (e: FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim()) {
      showSnackbar('문서 제목을 입력해주세요.', 'error');
      return;
    }
    if (!templateFile) {
      showSnackbar('업로드할 PDF 파일을 선택해주세요.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', templateTitle.trim());
    formData.append('documentRole', templateDocumentRole);
    formData.append('file', templateFile);

    setIsUploadingTemplate(true);
    try {
      await api.post(`${basePath}/templates`, formData);
      showSnackbar('문서 양식을 업로드했습니다.', 'success');
      setTemplateTitle('');
      setTemplateDocumentRole('CONTRACT');
      setTemplateFile(null);
      if (templateFileInputRef.current) templateFileInputRef.current.value = '';
      setIsTemplateFormOpen(false);
      setTemplates(await fetchTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 양식 업로드에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  const handleDuplicateTemplate = async (templateId: number) => {
    setProcessingTemplateId(templateId);
    try {
      await api.post(`${basePath}/templates/${templateId}/duplicate`, {});
      showSnackbar('문서 양식을 복제했습니다.', 'success');
      setTemplates(await fetchTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 양식 복제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingTemplateId(null);
    }
  };

  const startEditTemplate = (template: TemplateSummary) => {
    setViewingTemplateId(null);
    setDeletingTemplateId(null);
    setEditingTemplateId(template.id);
    setEditTemplateTitle(template.title);
    setEditTemplateDocumentRole(template.documentRole);
  };

  const handleSaveTemplateEdit = async (templateId: number) => {
    if (!editTemplateTitle.trim()) {
      showSnackbar('문서 제목을 입력해주세요.', 'error');
      return;
    }
    setProcessingTemplateId(templateId);
    try {
      await api.put(`${basePath}/templates/${templateId}`, {
        title: editTemplateTitle.trim(),
        documentRole: editTemplateDocumentRole,
      });
      showSnackbar('문서 양식을 저장했습니다.', 'success');
      setEditingTemplateId(null);
      setTemplates(await fetchTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 양식 저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingTemplateId(null);
    }
  };

  const openDeleteTemplate = (templateId: number) => {
    setViewingTemplateId(null);
    setEditingTemplateId(null);
    setDeletingTemplateId(templateId);
  };

  const handleDeleteTemplate = async (templateId: number) => {
    setProcessingTemplateId(templateId);
    try {
      await api.delete(`${basePath}/templates/${templateId}`);
      showSnackbar('문서 양식을 삭제했습니다.', 'success');
      setDeletingTemplateId(null);
      setTemplates(await fetchTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 양식 삭제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setProcessingTemplateId(null);
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

  const isCompleted = ceremony.status === 'COMPLETED';
  const isDraft = ceremony.status === 'DRAFT';
  const registerDisabledReason = isCompleted
    ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
    : isDraft
      ? '플랜을 확정해야 등록할 수 있습니다. 행사 수정 화면에서 플랜을 확정해주세요.'
      : undefined;
  const viewingSigner = signers.find((s) => s.id === viewingSignerId) ?? null;
  const viewingTemplate = templates.find((t) => t.id === viewingTemplateId) ?? null;
  const viewingEvent = events.find((e) => e.id === viewingEventId) ?? null;

  return (
    <div>
      <Link
        to={`/org/ceremonies/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4"
      >
        <ArrowLeft size={16} />
        행사 목록으로
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <FileSignature size={20} className="text-gray-400" />
            {ceremony.title}
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${CEREMONY_STATUS_COLOR[ceremony.status]}`}
            >
              {CEREMONY_STATUS_LABEL[ceremony.status]}
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">플랜: {plan?.name ?? `#${ceremony.billingPlanId}`}</p>
          {isCompleted && (
            <p className="mt-1 text-xs text-gray-400">완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.</p>
          )}
        </div>
        <Link
          to={`${detailPath}/edit`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-200 text-gray-600 text-sm font-medium hover:border-gray-400 transition-colors"
        >
          <Settings size={16} />
          행사 수정
        </Link>
      </div>

      {isDraft && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-700">
            아직 플랜 확정 전입니다. 서명자/문서/하위 행사를 등록하려면 먼저 플랜을 확정해주세요.
          </p>
          <Link
            to={`${detailPath}/edit`}
            className="shrink-0 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            플랜 확정하러 가기
          </Link>
        </div>
      )}

      {/* 서명자 관리 */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setIsSignersSectionOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            {isSignersSectionOpen ? (
              <ChevronUp size={16} className="shrink-0 text-gray-400" />
            ) : (
              <ChevronDown size={16} className="shrink-0 text-gray-400" />
            )}
            <div>
              <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                <Users size={14} />
                서명자
                <span className="font-normal text-gray-400">({signers.length})</span>
                {capacityStatus && (
                  <span className="font-normal text-gray-400">
                    · 등록 가능 인원 {formatCapacity(capacityStatus.signerLimit, '명')}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs text-gray-400">이 행사의 하위 행사(TEST/MAIN)가 명단을 공유합니다.</p>
            </div>
          </button>
          {isSignersSectionOpen && !isSignerFormOpen && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadSignerExcelTemplate}
                disabled={isDownloadingSignerTemplate}
                className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                <Download size={12} />
                엑셀 양식
              </button>
              <input
                ref={signerExcelInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleUploadSignerExcel}
              />
              <button
                onClick={() => signerExcelInputRef.current?.click()}
                disabled={Boolean(registerDisabledReason) || isUploadingSignerExcel}
                title={registerDisabledReason}
                className="flex items-center gap-1 px-3 py-1 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                <Upload size={12} />
                {isUploadingSignerExcel ? '업로드 중...' : '엑셀 업로드'}
              </button>
              <button
                onClick={() => setIsSignerFormOpen(true)}
                disabled={Boolean(registerDisabledReason)}
                title={registerDisabledReason}
                className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-950"
              >
                <Plus size={12} />
                서명자 등록
              </button>
            </div>
          )}
        </div>

        {isSignersSectionOpen && (
        <>
        {isSignerFormOpen && (
          <form
            onSubmit={handleAddSigner}
            className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={isAddingSigner}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">소속</label>
              <input
                type="text"
                value={signerAffiliation}
                onChange={(e) => setSignerAffiliation(e.target.value)}
                disabled={isAddingSigner}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">직책</label>
              <input
                type="text"
                value={signerPosition}
                onChange={(e) => setSignerPosition(e.target.value)}
                disabled={isAddingSigner}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isAddingSigner}
                className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {isAddingSigner ? '등록 중...' : '등록'}
              </button>
              <button
                type="button"
                onClick={() => setIsSignerFormOpen(false)}
                disabled={isAddingSigner}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </form>
        )}

        <ListContainer isLoading={isSignersLoading} isEmpty={signers.length === 0} emptyMessage="아직 등록된 서명자가 없습니다.">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-2">이름</th>
                <th className="text-left font-medium px-4 py-2">소속</th>
                <th className="text-left font-medium px-4 py-2">직책</th>
                <th className="text-right font-medium px-4 py-2">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {signers.map((signer) => (
                <tr key={signer.id}>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setViewingSignerId(signer.id)}
                      className="text-gray-950 hover:underline text-left"
                    >
                      {signer.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{signer.affiliation ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{signer.position ?? '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => startEditSigner(signer)}
                        disabled={processingSignerId === signer.id || signer.locked || isCompleted}
                        title={
                          isCompleted
                            ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                            : signer.locked
                              ? '시작되었거나 종료된 하위 행사에 배정돼 수정할 수 없습니다.'
                              : undefined
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                      <button
                        onClick={() => openDeleteSigner(signer.id)}
                        disabled={processingSignerId === signer.id || !signer.deletable || isCompleted}
                        title={
                          isCompleted
                            ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                            : !signer.deletable
                              ? '서명란에 배정됐거나 서명·감사 기록이 남아 있어 삭제할 수 없습니다.'
                              : undefined
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContainer>
        </>
        )}
      </section>

      <Modal open={viewingSigner !== null} onClose={() => setViewingSignerId(null)} title="서명자 상세">
        {viewingSigner && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">이름</p>
              <p className="text-sm text-gray-950">{viewingSigner.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">소속</p>
              <p className="text-sm text-gray-950">{viewingSigner.affiliation ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">직책</p>
              <p className="text-sm text-gray-950">{viewingSigner.position ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">역할 코드</p>
              <p className="text-sm text-gray-950">{viewingSigner.roleCode ?? '-'}</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingSignerId(null)}
                className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editingSignerId !== null} onClose={() => setEditingSignerId(null)} title="서명자 수정">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
            <input
              type="text"
              value={editSignerName}
              onChange={(e) => setEditSignerName(e.target.value)}
              disabled={processingSignerId === editingSignerId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">소속</label>
            <input
              type="text"
              value={editSignerAffiliation}
              onChange={(e) => setEditSignerAffiliation(e.target.value)}
              disabled={processingSignerId === editingSignerId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">직책</label>
            <input
              type="text"
              value={editSignerPosition}
              onChange={(e) => setEditSignerPosition(e.target.value)}
              disabled={processingSignerId === editingSignerId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">역할 코드</label>
            <input
              type="text"
              value={editSignerRoleCode}
              onChange={(e) => setEditSignerRoleCode(e.target.value)}
              disabled={processingSignerId === editingSignerId}
              placeholder="선택 입력"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditingSignerId(null)}
              disabled={processingSignerId === editingSignerId}
              className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => editingSignerId !== null && handleSaveSignerEdit(editingSignerId)}
              disabled={processingSignerId === editingSignerId}
              className="px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {processingSignerId === editingSignerId ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deletingSignerId !== null}
        title="서명자 삭제"
        message={`"${signers.find((s) => s.id === deletingSignerId)?.name ?? ''}" 서명자를 정말 삭제할까요?`}
        isSubmitting={processingSignerId === deletingSignerId}
        onConfirm={() => deletingSignerId !== null && handleDeleteSigner(deletingSignerId)}
        onCancel={() => setDeletingSignerId(null)}
      />

      {/* 문서 양식 관리 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setIsTemplatesSectionOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            {isTemplatesSectionOpen ? (
              <ChevronUp size={16} className="shrink-0 text-gray-400" />
            ) : (
              <ChevronDown size={16} className="shrink-0 text-gray-400" />
            )}
            <div>
              <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                <FileText size={14} />
                문서 양식
                <span className="font-normal text-gray-400">({templates.length})</span>
                {capacityStatus && (
                  <span className="font-normal text-gray-400">
                    · 등록 가능 문서 수 {formatCapacity(capacityStatus.templateLimit, '건')}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs text-gray-400">PDF 문서를 올리고, 문서 위에 서명란을 배치합니다.</p>
            </div>
          </button>
          {isTemplatesSectionOpen && !isTemplateFormOpen && (
            <button
              onClick={() => setIsTemplateFormOpen(true)}
              disabled={Boolean(registerDisabledReason)}
              title={registerDisabledReason}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-950"
            >
              <Plus size={12} />
              문서 업로드
            </button>
          )}
        </div>

        {isTemplatesSectionOpen && (
        <>

        {isTemplateFormOpen && (
          <form
            onSubmit={handleUploadTemplate}
            className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
              <input
                type="text"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                disabled={isUploadingTemplate}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">문서 유형</label>
              <select
                value={templateDocumentRole}
                onChange={(e) => setTemplateDocumentRole(e.target.value as TemplateDocumentRole)}
                disabled={isUploadingTemplate}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
              >
                <option value="CONTRACT">계약서</option>
                <option value="EXHIBITION">전시문서</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">PDF 파일</label>
              <input
                ref={templateFileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleTemplateFileChange}
                disabled={isUploadingTemplate}
                className="text-sm text-gray-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:border-gray-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isUploadingTemplate}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <Upload size={12} />
                {isUploadingTemplate ? '업로드 중...' : '업로드'}
              </button>
              <button
                type="button"
                onClick={() => setIsTemplateFormOpen(false)}
                disabled={isUploadingTemplate}
                className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </form>
        )}

        <ListContainer isLoading={isTemplatesLoading} isEmpty={templates.length === 0} emptyMessage="아직 업로드된 문서 양식이 없습니다.">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-2">문서 유형</th>
                <th className="text-left font-medium px-4 py-2">양식명</th>
                <th className="text-left font-medium px-4 py-2">상태</th>
                <th className="text-left font-medium px-4 py-2">서명란</th>
                <th className="text-right font-medium px-4 py-2">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-4 py-2 text-gray-600">{DOCUMENT_ROLE_LABEL[template.documentRole]}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setViewingTemplateId(template.id)}
                      className="block text-left font-medium text-gray-950 hover:underline"
                    >
                      {template.title}
                    </button>
                    <p className="text-xs text-gray-400">{template.originalFilename}</p>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${TEMPLATE_STATUS_COLOR[template.status]}`}
                    >
                      {TEMPLATE_STATUS_LABEL[template.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{template.fieldCount}개</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleDuplicateTemplate(template.id)}
                        disabled={processingTemplateId === template.id || Boolean(registerDisabledReason)}
                        title={registerDisabledReason}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                      >
                        <Copy size={12} />
                        복제
                      </button>
                      <Link
                        to={`${detailPath}/templates/${template.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <ExternalLink size={12} />
                        서명란 배치
                      </Link>
                      <button
                        onClick={() => startEditTemplate(template)}
                        disabled={processingTemplateId === template.id || template.locked || isCompleted}
                        title={
                          isCompleted
                            ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                            : template.locked
                              ? '시작되었거나 종료된 하위 행사에 매핑돼 수정할 수 없습니다.'
                              : undefined
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                      <button
                        onClick={() => openDeleteTemplate(template.id)}
                        disabled={processingTemplateId === template.id || !template.deletable || isCompleted}
                        title={
                          isCompleted
                            ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                            : !template.deletable
                              ? '이미 하위 행사에 매핑된 문서 양식은 삭제할 수 없습니다.'
                              : undefined
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContainer>
        </>
        )}
      </section>

      <Modal open={viewingTemplate !== null} onClose={() => setViewingTemplateId(null)} title="문서 양식 상세">
        {viewingTemplate && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">제목</p>
              <p className="text-sm text-gray-950">{viewingTemplate.title}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">문서 유형</p>
              <p className="text-sm text-gray-950">{DOCUMENT_ROLE_LABEL[viewingTemplate.documentRole]}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">원본 파일명</p>
              <p className="text-sm text-gray-950">{viewingTemplate.originalFilename}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">상태</p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${TEMPLATE_STATUS_COLOR[viewingTemplate.status]}`}
              >
                {TEMPLATE_STATUS_LABEL[viewingTemplate.status]}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">서명란</p>
              <p className="text-sm text-gray-950">{viewingTemplate.fieldCount}개</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingTemplateId(null)}
                className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editingTemplateId !== null} onClose={() => setEditingTemplateId(null)} title="문서 양식 수정">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input
              type="text"
              value={editTemplateTitle}
              onChange={(e) => setEditTemplateTitle(e.target.value)}
              disabled={processingTemplateId === editingTemplateId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">문서 유형</label>
            <select
              value={editTemplateDocumentRole}
              onChange={(e) => setEditTemplateDocumentRole(e.target.value as TemplateDocumentRole)}
              disabled={processingTemplateId === editingTemplateId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
            >
              <option value="CONTRACT">계약서</option>
              <option value="EXHIBITION">전시문서</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditingTemplateId(null)}
              disabled={processingTemplateId === editingTemplateId}
              className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => editingTemplateId !== null && handleSaveTemplateEdit(editingTemplateId)}
              disabled={processingTemplateId === editingTemplateId}
              className="px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {processingTemplateId === editingTemplateId ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deletingTemplateId !== null}
        title="문서 양식 삭제"
        message={`"${templates.find((t) => t.id === deletingTemplateId)?.title ?? ''}" 문서 양식을 정말 삭제할까요? 이미 하위 행사에 매핑된 문서 양식은 삭제할 수 없습니다.`}
        isSubmitting={processingTemplateId === deletingTemplateId}
        onConfirm={() => deletingTemplateId !== null && handleDeleteTemplate(deletingTemplateId)}
        onCancel={() => setDeletingTemplateId(null)}
      />

      {/* 하위 행사 목록 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setIsEventsSectionOpen((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            {isEventsSectionOpen ? (
              <ChevronUp size={16} className="shrink-0 text-gray-400" />
            ) : (
              <ChevronDown size={16} className="shrink-0 text-gray-400" />
            )}
            <div>
              <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                <CalendarClock size={14} />
                하위 행사
                <span className="font-normal text-gray-400">({events.length})</span>
                {capacityStatus && (
                  <span className="font-normal text-gray-400">
                    · 등록 가능 테스트 행사 {formatCapacity(capacityStatus.testEventLimit, '회')} · 등록 가능 본행사{' '}
                    {formatCapacity(capacityStatus.mainEventLimit, '회')}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                실제로 서명이 진행되는 단위입니다. TEST로 리허설하거나 MAIN으로 정식 진행하며, 문서 매핑과
                서명자 배정을 마쳐야 시작할 수 있습니다.
              </p>
            </div>
          </button>
          {isEventsSectionOpen && (
            registerDisabledReason ? (
              <button
                type="button"
                disabled
                title={registerDisabledReason}
                className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium opacity-40"
              >
                <Plus size={12} />
                새 하위 행사
              </button>
            ) : (
              <Link
                to={`${detailPath}/events/new`}
                className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
              >
                <Plus size={12} />
                새 하위 행사
              </Link>
            )
          )}
        </div>

        {isEventsSectionOpen && (
        <ListContainer isLoading={isEventsLoading} isEmpty={events.length === 0} emptyMessage="아직 등록된 하위 행사가 없습니다.">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium px-4 py-2">구분</th>
                <th className="text-left font-medium px-4 py-2">행사 상세명</th>
                <th className="text-left font-medium px-4 py-2">상태</th>
                <th className="text-left font-medium px-4 py-2">일정</th>
                <th className="text-right font-medium px-4 py-2">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => {
                const isEventLocked = event.status === 'STARTED' || event.status === 'FINISHED';
                return (
                  <tr key={event.id}>
                    <td className="px-4 py-2 text-gray-600">{EVENT_TYPE_LABEL[event.eventType]}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setViewingEventId(event.id)}
                        className="text-left font-medium text-gray-950 hover:underline"
                      >
                        {event.name}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${EVENT_STATUS_COLOR[event.status]}`}
                      >
                        {EVENT_STATUS_LABEL[event.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatEventSchedule(event)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`${detailPath}/events/${event.id}/mapping`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                        >
                          <FileText size={12} />
                          문서 매핑
                        </Link>
                        <Link
                          to={`${detailPath}/events/${event.id}/control`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                        >
                          <Settings size={12} />
                          행사 제어
                        </Link>
                        <button
                          onClick={() => startEditEvent(event)}
                          disabled={processingEventId === event.id || isEventLocked || isCompleted}
                          title={
                            isCompleted
                              ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                              : isEventLocked
                                ? '시작되었거나 종료된 하위 행사는 수정할 수 없습니다.'
                                : undefined
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                        >
                          <Pencil size={12} />
                          수정
                        </button>
                        <button
                          onClick={() => openDeleteEvent(event.id)}
                          disabled={processingEventId === event.id || isEventLocked || isCompleted}
                          title={
                            isCompleted
                              ? '완료된 행사입니다. 하위 데이터는 조회만 할 수 있습니다.'
                              : isEventLocked
                                ? '시작되었거나 종료된 하위 행사는 삭제할 수 없습니다.'
                                : undefined
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <Trash2 size={12} />
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ListContainer>
        )}
      </section>

      <Modal open={viewingEvent !== null} onClose={() => setViewingEventId(null)} title="하위 행사 상세" widthClassName="max-w-lg">
        {viewingEvent && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">구분</p>
              <p className="text-sm text-gray-950">{EVENT_TYPE_LABEL[viewingEvent.eventType]}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">이름</p>
              <p className="text-sm text-gray-950">{viewingEvent.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">상태</p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${EVENT_STATUS_COLOR[viewingEvent.status]}`}
              >
                {EVENT_STATUS_LABEL[viewingEvent.status]}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">장소</p>
              <p className="text-sm text-gray-950">{viewingEvent.venue ?? '-'}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">예정 시작</p>
                <p className="text-sm text-gray-950">{formatEventDateTime(viewingEvent.scheduledStartAt) ?? '미정'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">예정 종료</p>
                <p className="text-sm text-gray-950">{formatEventDateTime(viewingEvent.scheduledEndAt) ?? '미정'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">실제 시작</p>
                <p className="text-sm text-gray-950">{formatEventDateTime(viewingEvent.actualStartAt) ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">실제 종료</p>
                <p className="text-sm text-gray-950">{formatEventDateTime(viewingEvent.actualEndAt) ?? '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">설명</p>
              <p className="text-sm text-gray-950 whitespace-pre-wrap">{viewingEvent.description ?? '-'}</p>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingEventId(null)}
                className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={editingEventId !== null} onClose={() => setEditingEventId(null)} title="하위 행사 수정" widthClassName="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
            <input
              type="text"
              value={editEventName}
              onChange={(e) => setEditEventName(e.target.value)}
              disabled={processingEventId === editingEventId}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">장소</label>
            <input
              type="text"
              value={editEventVenue}
              onChange={(e) => setEditEventVenue(e.target.value)}
              disabled={processingEventId === editingEventId}
              placeholder="선택 입력"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">예정 시작</label>
              <input
                type="datetime-local"
                value={editEventScheduledStart}
                onChange={(e) => setEditEventScheduledStart(e.target.value)}
                disabled={processingEventId === editingEventId}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">예정 종료</label>
              <input
                type="datetime-local"
                value={editEventScheduledEnd}
                onChange={(e) => setEditEventScheduledEnd(e.target.value)}
                disabled={processingEventId === editingEventId}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">설명</label>
            <textarea
              value={editEventDescription}
              onChange={(e) => setEditEventDescription(e.target.value)}
              disabled={processingEventId === editingEventId}
              rows={2}
              placeholder="선택 입력"
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">적용 선택옵션</label>
            {availableEventFeatures.length === 0 ? (
              <p className="text-xs text-gray-400">적용할 수 있는 선택옵션이 없습니다. 구매는 행사 상세에서 합니다.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md px-2">
                {availableEventFeatures.map((feature) => (
                  <li key={feature.id} className="flex items-center gap-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleEditEventFeature(feature.id)}
                      disabled={processingEventId === editingEventId}
                      className="shrink-0 text-gray-950"
                    >
                      <SquareCheckBig
                        size={16}
                        className={editEventFeatureIds.includes(feature.id) ? 'text-gray-950' : 'text-gray-300'}
                      />
                    </button>
                    <span className="text-sm text-gray-950">{feature.name}</span>
                    {feature.exclusivityGroup && (
                      <span className="text-[11px] text-gray-400">
                        ({feature.exclusivityGroup} 중 하나만 선택)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditingEventId(null)}
              disabled={processingEventId === editingEventId}
              className="px-4 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => editingEventId !== null && handleSaveEventEdit(editingEventId)}
              disabled={processingEventId === editingEventId}
              className="px-4 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {processingEventId === editingEventId ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deletingEventId !== null}
        title="하위 행사 삭제"
        message={`"${events.find((e) => e.id === deletingEventId)?.name ?? ''}" 하위 행사를 정말 삭제할까요?`}
        isSubmitting={processingEventId === deletingEventId}
        onConfirm={() => deletingEventId !== null && handleDeleteEvent(deletingEventId)}
        onCancel={() => setDeletingEventId(null)}
      />
    </div>
  );
};
