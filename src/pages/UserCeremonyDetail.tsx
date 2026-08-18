import { Fragment, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  FileSignature,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  BillingPlanSummary,
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyEventType,
  CeremonyStatus,
  CeremonySummary,
  SignerSummary,
  TemplateDocumentRole,
  TemplateStatus,
  TemplateSummary,
} from '../types';

const CEREMONY_STATUS_LABEL: Record<CeremonyStatus, string> = { IN_PROGRESS: '진행중', COMPLETED: '완료' };
const CEREMONY_STATUS_COLOR: Record<CeremonyStatus, string> = {
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

const DOCUMENT_ROLE_LABEL: Record<TemplateDocumentRole, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };
/** 저장된 상태값이 아니라 서명란(fieldCount) 유무로 매번 계산돼서 온다 — 1개 이상이면 COMPLETED. */
const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = { DRAFT: '설정 필요', COMPLETED: '설정 완료' };
const TEMPLATE_STATUS_COLOR: Record<TemplateStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

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

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [isSignersLoading, setIsSignersLoading] = useState(true);
  const [isSignerFormOpen, setIsSignerFormOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [signerPosition, setSignerPosition] = useState('');
  const [signerAffiliation, setSignerAffiliation] = useState('');
  const [signerRoleCode, setSignerRoleCode] = useState('');
  const [isAddingSigner, setIsAddingSigner] = useState(false);
  const [copiedSignerId, setCopiedSignerId] = useState<number | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDocumentRole, setTemplateDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  const [processingTemplateId, setProcessingTemplateId] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editTemplateTitle, setEditTemplateTitle] = useState('');
  const [editTemplateDocumentRole, setEditTemplateDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);

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
        roleCode: signerRoleCode.trim() || null,
      });
      showSnackbar('서명자를 등록했습니다.', 'success');
      setSignerName('');
      setSignerPosition('');
      setSignerAffiliation('');
      setSignerRoleCode('');
      setIsSignerFormOpen(false);
      setSigners(await fetchSigners());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명자 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsAddingSigner(false);
    }
  };

  const handleCopySignerAccessKey = async (signer: SignerSummary) => {
    try {
      await navigator.clipboard.writeText(signer.accessKey);
      setCopiedSignerId(signer.id);
      setTimeout(() => setCopiedSignerId((prev) => (prev === signer.id ? null : prev)), 1500);
    } catch {
      showSnackbar('접속키 복사에 실패했습니다.', 'error');
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

      {/* 서명자 관리 */}
      <section className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
              <Users size={14} />
              서명자
            </h2>
            <p className="mt-1 text-xs text-gray-400">이 행사의 하위 행사(TEST/MAIN)가 명단을 공유합니다.</p>
          </div>
          {!isSignerFormOpen && !isCompleted && (
            <button
              onClick={() => setIsSignerFormOpen(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              서명자 등록
            </button>
          )}
        </div>

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
              <label className="block text-xs font-medium text-gray-500 mb-1">직책</label>
              <input
                type="text"
                value={signerPosition}
                onChange={(e) => setSignerPosition(e.target.value)}
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
              <label className="block text-xs font-medium text-gray-500 mb-1">역할 코드</label>
              <input
                type="text"
                value={signerRoleCode}
                onChange={(e) => setSignerRoleCode(e.target.value)}
                disabled={isAddingSigner}
                placeholder="선택 입력"
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
                <th className="text-left font-medium px-4 py-2">직책</th>
                <th className="text-left font-medium px-4 py-2">소속</th>
                <th className="text-right font-medium px-4 py-2">접속키</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {signers.map((signer) => (
                <tr key={signer.id}>
                  <td className="px-4 py-2 text-gray-950">{signer.name}</td>
                  <td className="px-4 py-2 text-gray-500">{signer.position ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{signer.affiliation ?? '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleCopySignerAccessKey(signer)}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-950"
                    >
                      {copiedSignerId === signer.id ? (
                        <>
                          <Check size={12} />
                          복사됨
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          복사
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContainer>
      </section>

      {/* 문서 양식 관리 */}
      <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
              <FileText size={14} />
              문서 양식
            </h2>
            <p className="mt-1 text-xs text-gray-400">PDF 문서를 올리고, 문서 위에 서명란을 배치합니다.</p>
          </div>
          {!isTemplateFormOpen && !isCompleted && (
            <button
              onClick={() => setIsTemplateFormOpen(true)}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              문서 업로드
            </button>
          )}
        </div>

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
                <Fragment key={template.id}>
                  <tr>
                    <td className="px-4 py-2 text-gray-600">{DOCUMENT_ROLE_LABEL[template.documentRole]}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium text-gray-950">{template.title}</p>
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
                          disabled={processingTemplateId === template.id || isCompleted}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40"
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
                        {!isCompleted && (
                          <>
                            <button
                              onClick={() => startEditTemplate(template)}
                              disabled={processingTemplateId === template.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50 disabled:opacity-40"
                            >
                              <Pencil size={12} />
                              수정
                            </button>
                            <button
                              onClick={() => openDeleteTemplate(template.id)}
                              disabled={processingTemplateId === template.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 size={12} />
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingTemplateId === template.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
                            <input
                              type="text"
                              value={editTemplateTitle}
                              onChange={(e) => setEditTemplateTitle(e.target.value)}
                              disabled={processingTemplateId === template.id}
                              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">문서 유형</label>
                            <select
                              value={editTemplateDocumentRole}
                              onChange={(e) => setEditTemplateDocumentRole(e.target.value as TemplateDocumentRole)}
                              disabled={processingTemplateId === template.id}
                              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                            >
                              <option value="CONTRACT">계약서</option>
                              <option value="EXHIBITION">전시문서</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveTemplateEdit(template.id)}
                              disabled={processingTemplateId === template.id}
                              className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                            >
                              {processingTemplateId === template.id ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={() => setEditingTemplateId(null)}
                              disabled={processingTemplateId === template.id}
                              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {deletingTemplateId === template.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-700">
                            "{template.title}" 문서 양식을 정말 삭제할까요? 이미 하위 행사에 매핑된 문서
                            양식은 삭제할 수 없습니다.
                          </p>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={processingTemplateId === template.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 shrink-0"
                          >
                            <Trash2 size={12} />
                            삭제 확정
                          </button>
                          <button
                            onClick={() => setDeletingTemplateId(null)}
                            disabled={processingTemplateId === template.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50 shrink-0"
                          >
                            <X size={12} />
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </ListContainer>
      </section>

      {/* 하위 행사 목록 */}
      <section className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
            <CalendarClock size={14} />
            하위 행사
          </h2>
          {!isCompleted && (
            <Link
              to={`${detailPath}/events/new`}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800"
            >
              <Plus size={12} />
              새 하위 행사
            </Link>
          )}
        </div>

        <ListContainer isLoading={isEventsLoading} isEmpty={events.length === 0} emptyMessage="아직 등록된 하위 행사가 없습니다.">
          <ul className="divide-y divide-gray-100">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  to={`${detailPath}/events/${event.id}`}
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
