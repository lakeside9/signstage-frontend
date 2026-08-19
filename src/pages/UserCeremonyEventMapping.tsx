import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Lock,
  PlayCircle,
  RotateCw,
  Save,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type {
  CeremonyEventStatus,
  CeremonyEventSummary,
  CeremonyTemplateSummary,
  SignerSummary,
  TemplateDocumentRole,
  TemplateFieldSummary,
  TemplateSummary,
} from '../types';

const STATUS_LABEL: Record<CeremonyEventStatus, string> = {
  DRAFT: '준비 중',
  READY: '시작 대기',
  STARTED: '진행 중',
  FINISHED: '종료',
};

/** 역할별로 화면에 보여줄 문서 하나의 미리보기 상태 — legacy의 exhibition/contract 상태 쌍과 같은 모양이다. */
interface DocumentPanelState {
  templateId: number | null;
  templateTitle: string | null;
  fields: TemplateFieldSummary[];
  pageCount: number;
  currentPage: number;
  scale: number;
  rotation: number;
  imageUrl: string | null;
}

const emptyPanel: DocumentPanelState = {
  templateId: null,
  templateTitle: null,
  fields: [],
  pageCount: 0,
  currentPage: 0,
  scale: 1,
  rotation: 0,
  imageUrl: null,
};

/**
 * 페이지 이미지를 blob URL로 받아온다(JWT 인증이라 legacy처럼 `<img src>`를 직접 못 쓴다) —
 * 다른 화면들과 같은 `api.getBlob` → `URL.createObjectURL` 패턴.
 */
const usePageImage = (
  templatesApiBasePath: string,
  panel: DocumentPanelState,
  setPanel: (updater: (prev: DocumentPanelState) => DocumentPanelState) => void,
) => {
  useEffect(() => {
    if (!panel.templateId || panel.pageCount === 0) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await api.getBlob(
          `${templatesApiBasePath}/templates/${panel.templateId}/pages/${panel.currentPage}?scale=${panel.scale}`,
        );
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setPanel((prev) => ({ ...prev, imageUrl: objectUrl }));
        }
      } catch {
        // 이미지 로드가 실패해도 필드 오버레이 정보는 유효하므로 화면을 막지 않는다.
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templatesApiBasePath, panel.templateId, panel.currentPage, panel.scale]);
};

/**
 * 서명용 문서매핑 화면. legacy(~/Works/eform/source/signstage/signstage-frontend)
 * `CeremonyEventDetail.tsx`(sub/11)와 동일한 모양으로 만들었다 — 전시용(EXHIBITION)/서명용
 * (CONTRACT) 문서를 위아래로 쌓아 각각 실제 PDF 페이지 이미지 위에 서명란을 오버레이로
 * 보여주고(줌/회전/페이지 이동 포함), "문서 선택" 버튼이 여는 모달에서 그 역할의 문서 양식
 * 목록 중 하나를 고른다.
 *
 * legacy는 `<img src=...>`를 직접 참조하지만(쿠키 인증 추정) 우리는 JWT Bearer 헤더 인증이라
 * `api.getBlob(...)` → `URL.createObjectURL(...)` 패턴으로 바꿨다(다른 화면들과 동일).
 * 렌더링 자체도 legacy처럼 Konva가 아니라 순수 `<img>` + 절대좌표 `<div>` 오버레이로 만들어
 * 픽셀 단위로 legacy와 같은 구조를 유지했다(행사제어/프로젝터의 Konva 기반 실시간 렌더링과는
 * 다른 요구 — 여기는 서명 전 정적 미리보기라 실시간 스트로크가 필요 없다).
 *
 * legacy는 이미 매핑된 역할도 다시 선택해 통째로 교체(PUT)한다. 우리 백엔드는 그런 통째
 * 교체 엔드포인트 대신 매핑 해제(DELETE .../templates/{mappingId})를 새로 만들었다 — "교체"는
 * 저장 시점에 기존 매핑을 지우고 새로 만드는 두 단계로 처리한다(REST 자원 하나씩 다루는 이
 * 프로젝트 관례). 각 문서 패널의 "해제" 버튼은 교체 없이 매핑만 지우는 용도다.
 */
export const UserCeremonyEventMapping: FC = () => {
  const { organizationId, ceremonyId, eventId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    eventId: string;
  }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [event, setEvent] = useState<CeremonyEventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [mappedTemplates, setMappedTemplates] = useState<CeremonyTemplateSummary[]>([]);

  const [exhibition, setExhibition] = useState<DocumentPanelState>(emptyPanel);
  const [contract, setContract] = useState<DocumentPanelState>(emptyPanel);

  // 아직 저장 전인 새 선택 — 이미 매핑된 역할이면 "교체" 의미가 된다(저장 시점에 기존
  // 매핑을 지우고 이 templateId로 새로 매핑한다).
  const [pendingExhibitionId, setPendingExhibitionId] = useState<number | null>(null);
  const [pendingContractId, setPendingContractId] = useState<number | null>(null);
  const [isUnmapping, setIsUnmapping] = useState<TemplateDocumentRole | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<TemplateDocumentRole | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<TemplateSummary[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [modalSelectedId, setModalSelectedId] = useState<number | null>(null);

  const basePath = `/org/ceremonies/${organizationId}/${ceremonyId}`;
  const apiBasePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;

  const fetchMappedTemplates = async () => {
    const response = await api.get(`${apiBasePath}/events/${eventId}/templates`);
    return response.data as CeremonyTemplateSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [eventRes, signersRes, mapped] = await Promise.all([
          api.get(`${apiBasePath}/events/${eventId}`),
          api.get(`${apiBasePath}/signers`),
          fetchMappedTemplates(),
        ]);
        if (cancelled) return;
        setEvent(eventRes.data as CeremonyEventSummary);
        setSigners(signersRes.data as SignerSummary[]);
        setMappedTemplates(mapped);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '문서매핑 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
          navigate(basePath, { replace: true });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, eventId]);

  // 매핑된 CONTRACT/EXHIBITION 각 첫 번째 템플릿의 제목/서명란/페이지 수를 불러온다.
  useEffect(() => {
    const exhibitionMapping = mappedTemplates.find((m) => m.documentRole === 'EXHIBITION');
    const contractMapping = mappedTemplates.find((m) => m.documentRole === 'CONTRACT');

    const loadPanel = async (templateId: number, setPanel: (updater: (prev: DocumentPanelState) => DocumentPanelState) => void) => {
      try {
        const [templateRes, fieldsRes, infoRes] = await Promise.all([
          api.get(`${apiBasePath}/templates/${templateId}`),
          api.get(`${apiBasePath}/templates/${templateId}/fields`),
          api.get(`${apiBasePath}/templates/${templateId}/info`),
        ]);
        setPanel((prev) => ({
          ...prev,
          templateId,
          templateTitle: (templateRes.data as TemplateSummary).title,
          fields: fieldsRes.data as TemplateFieldSummary[],
          pageCount: (infoRes.data as { pageCount: number }).pageCount,
          currentPage: 0,
        }));
      } catch {
        showSnackbar('문서 정보를 불러오지 못했습니다.', 'error');
      }
    };

    if (exhibitionMapping) loadPanel(exhibitionMapping.templateId, setExhibition);
    if (contractMapping) loadPanel(contractMapping.templateId, setContract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedTemplates]);

  usePageImage(apiBasePath, exhibition, setExhibition);
  usePageImage(apiBasePath, contract, setContract);

  const isLocked = event ? event.status === 'STARTED' || event.status === 'FINISHED' : false;

  const openTemplateSelection = async (role: TemplateDocumentRole) => {
    setModalRole(role);
    setModalSelectedId(null);
    setIsModalOpen(true);
    setIsTemplatesLoading(true);
    try {
      const response = await api.get(`${apiBasePath}/templates`);
      const all = response.data as TemplateSummary[];
      setAvailableTemplates(all.filter((t) => t.documentRole === role));
    } catch {
      showSnackbar('문서 양식 목록을 불러오지 못했습니다.', 'error');
    } finally {
      setIsTemplatesLoading(false);
    }
  };

  const confirmTemplateSelection = () => {
    if (!modalSelectedId || !modalRole) return;
    if (modalRole === 'EXHIBITION') setPendingExhibitionId(modalSelectedId);
    else setPendingContractId(modalSelectedId);
    setIsModalOpen(false);
    setModalRole(null);
  };

  /** 이미 매핑된 역할에 새 선택이 있으면 "교체"다 — 기존 매핑을 먼저 지우고 새로 매핑한다. */
  const replaceOrMapRole = async (role: TemplateDocumentRole, newTemplateId: number) => {
    const existing = mappedTemplates.find((m) => m.documentRole === role);
    if (existing) {
      await api.delete(`${apiBasePath}/events/${eventId}/templates/${existing.id}`);
    }
    await api.post(`${apiBasePath}/events/${eventId}/templates`, {
      templateId: newTemplateId,
      documentRole: role,
    });
  };

  const handleSaveMappings = async () => {
    if (!pendingExhibitionId && !pendingContractId) return true;
    setIsSaving(true);
    try {
      if (pendingExhibitionId) await replaceOrMapRole('EXHIBITION', pendingExhibitionId);
      if (pendingContractId) await replaceOrMapRole('CONTRACT', pendingContractId);
      setPendingExhibitionId(null);
      setPendingContractId(null);
      setMappedTemplates(await fetchMappedTemplates());
      showSnackbar('문서 매핑이 저장되었습니다.', 'success');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 매핑 저장에 실패했습니다.';
      showSnackbar(message, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  /** 교체 없이 매핑만 지운다 — 저장 대기 중인 선택이 있었다면 그것도 함께 취소한다. */
  const handleUnmap = async (role: TemplateDocumentRole) => {
    const existing = mappedTemplates.find((m) => m.documentRole === role);
    if (!existing) return;

    setIsUnmapping(role);
    try {
      await api.delete(`${apiBasePath}/events/${eventId}/templates/${existing.id}`);
      if (role === 'EXHIBITION') {
        setPendingExhibitionId(null);
        setExhibition(emptyPanel);
      } else {
        setPendingContractId(null);
        setContract(emptyPanel);
      }
      setMappedTemplates(await fetchMappedTemplates());
      showSnackbar('문서 매핑을 해제했습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 매핑 해제에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsUnmapping(null);
    }
  };

  const handleGoToControl = async () => {
    if (!event) return;
    const saved = await handleSaveMappings();
    if (!saved) return;

    if (event.status === 'DRAFT') {
      try {
        const response = await api.post(`${apiBasePath}/events/${eventId}/ready`);
        setEvent(response.data as CeremonyEventSummary);
      } catch (err) {
        const message = err instanceof Error ? err.message : '시작 대기 전이에 실패했습니다.';
        showSnackbar(message, 'error');
        return;
      }
    }

    navigate(`${basePath}/events/${eventId}/control`);
  };

  if (isLoading || !event) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  const signerNameById = new Map(signers.map((s) => [s.id, s.name]));
  const hasPendingChanges = pendingExhibitionId != null || pendingContractId != null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] -m-6 bg-gray-50">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate(basePath)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-gray-950 truncate">서명용 문서매핑</h1>
              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border bg-gray-50 text-gray-600 border-gray-200">
                {STATUS_LABEL[event.status]}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{event.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLocked && (
            <button
              onClick={() => openTemplateSelection('EXHIBITION')}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50 text-gray-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              <Search size={14} className="text-amber-500" />
              {exhibition.templateId == null ? '전시용 문서 선택' : '전시용 문서 변경'}
            </button>
          )}
          {!isLocked && (
            <button
              onClick={() => openTemplateSelection('CONTRACT')}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 text-gray-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              <Search size={14} className="text-emerald-500" />
              {contract.templateId == null ? '서명용 문서 선택' : '서명용 문서 변경'}
            </button>
          )}

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {!isLocked && (
            <button
              onClick={handleSaveMappings}
              disabled={isSaving || !hasPendingChanges}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              저장
            </button>
          )}

          {(event.status === 'DRAFT' || event.status === 'READY') && (
            <button
              onClick={handleGoToControl}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              행사 제어
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="px-6 pt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Lock size={12} />
          시작 이후에는 문서 매핑을 바꿀 수 없습니다.
        </div>
      )}

      <div className="flex-1 bg-gray-100 p-6 overflow-hidden flex flex-col gap-6">
        <DocumentPanel
          roleLabel="전시용 문서 (EXHIBITION)"
          dotColorClass="bg-amber-500"
          emptyMessage="전시용 문서가 설정되지 않았습니다."
          panel={exhibition}
          setPanel={setExhibition}
          signerNameById={signerNameById}
          onUnmap={!isLocked ? () => handleUnmap('EXHIBITION') : undefined}
          isUnmapping={isUnmapping === 'EXHIBITION'}
          hasPendingReplacement={pendingExhibitionId != null}
        />
        <DocumentPanel
          roleLabel="서명용 문서 (CONTRACT)"
          dotColorClass="bg-emerald-500"
          emptyMessage="서명용 문서가 설정되지 않았습니다."
          panel={contract}
          setPanel={setContract}
          signerNameById={signerNameById}
          onUnmap={!isLocked ? () => handleUnmap('CONTRACT') : undefined}
          isUnmapping={isUnmapping === 'CONTRACT'}
          hasPendingReplacement={pendingContractId != null}
        />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {modalRole === 'EXHIBITION' ? '전시용 문서 선택' : '서명용 문서 선택'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">해당 역할의 문서 양식을 선택해주세요.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isTemplatesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="animate-spin text-gray-300 mb-3" size={32} />
                  <p className="text-sm text-gray-400">문서 양식을 불러오고 있습니다...</p>
                </div>
              ) : availableTemplates.length > 0 ? (
                <div className="grid gap-3">
                  {availableTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setModalSelectedId(tpl.id)}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        modalSelectedId === tpl.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <div
                        className={`mt-1 p-2 rounded-lg ${modalSelectedId === tpl.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                      >
                        <FileText size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 truncate">{tpl.title}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            ID: {tpl.id}
                          </span>
                        </div>
                      </div>
                      {modalSelectedId === tpl.id && (
                        <div className="self-center">
                          <CheckCircle size={24} className="text-indigo-500" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText size={48} className="text-gray-100 mb-4" />
                  <p className="text-gray-500 font-medium">검색된 문서 양식이 없습니다.</p>
                  <p className="text-xs text-gray-400 mt-1">해당 역할로 등록된 문서가 있는지 확인해주세요.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-colors"
              >
                취소
              </button>
              <button
                disabled={!modalSelectedId}
                onClick={confirmTemplateSelection}
                className="flex-[2] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all"
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DocumentPanelProps {
  roleLabel: string;
  dotColorClass: string;
  emptyMessage: string;
  panel: DocumentPanelState;
  setPanel: (updater: (prev: DocumentPanelState) => DocumentPanelState) => void;
  signerNameById: Map<number, string>;
  /** 매핑 해제 핸들러 — 잠긴 상태(STARTED/FINISHED)면 undefined를 넘겨 버튼 자체를 숨긴다. */
  onUnmap?: () => void;
  isUnmapping: boolean;
  /** 상단 "OO 문서 변경" 버튼으로 새 문서를 골라둔 상태 — "저장"을 눌러야 실제로 바뀐다. */
  hasPendingReplacement: boolean;
}

const DocumentPanel: FC<DocumentPanelProps> = ({
  roleLabel,
  dotColorClass,
  emptyMessage,
  panel,
  setPanel,
  signerNameById,
  onUnmap,
  isUnmapping,
  hasPendingReplacement,
}) => {
  const visibleFields = panel.fields.filter((f) => f.pageIndex === panel.currentPage);

  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColorClass}`} />
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-tight">{roleLabel}</span>
          <span className="text-[10px] text-gray-400 ml-1">{panel.templateTitle}</span>
          {hasPendingReplacement && (
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full ml-1">
              새 문서 선택됨 · 저장 대기
            </span>
          )}
          {onUnmap && panel.templateId != null && (
            <button
              onClick={onUnmap}
              disabled={isUnmapping}
              className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition-all disabled:opacity-50 ml-1"
            >
              {isUnmapping ? '해제 중...' : '해제'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <button
              disabled={panel.currentPage === 0}
              onClick={() => setPanel((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }))}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-bold text-gray-500 min-w-[30px] text-center">
              {panel.currentPage + 1} / {panel.pageCount || 1}
            </span>
            <button
              disabled={panel.currentPage >= panel.pageCount - 1}
              onClick={() => setPanel((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }))}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
            <button
              onClick={() => setPanel((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))}
              className="p-1.5 hover:bg-white rounded-md transition-all"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] font-bold w-10 text-center text-gray-500">{Math.round(panel.scale * 100)}%</span>
            <button
              onClick={() => setPanel((prev) => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))}
              className="p-1.5 hover:bg-white rounded-md transition-all"
            >
              <ZoomIn size={12} />
            </button>
          </div>
          <button
            onClick={() => setPanel((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 rounded-xl border border-gray-300 overflow-auto flex items-start justify-center p-6 relative shadow-inner">
        {panel.templateId ? (
          <div className="bg-white shadow-2xl relative origin-top" style={{ transform: `rotate(${panel.rotation}deg)` }}>
            {panel.imageUrl && <img src={panel.imageUrl} alt={roleLabel} className="max-w-none block" />}

            {visibleFields.map((field) => {
              const signerName = field.signerId != null ? signerNameById.get(field.signerId) : undefined;
              return (
                <div
                  key={field.id}
                  className={`absolute border-2 flex flex-col items-center justify-center transition-all z-10 ${
                    signerName ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500 bg-amber-500/10'
                  }`}
                  style={{
                    left: `${field.xRatio * 100}%`,
                    top: `${field.yRatio * 100}%`,
                    width: `${field.widthRatio * 100}%`,
                    height: `${field.heightRatio * 100}%`,
                  }}
                >
                  <span
                    className={`text-[9px] font-bold px-1 rounded shadow-sm ${
                      signerName ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                    }`}
                  >
                    {signerName ?? field.roleCode ?? field.fieldName ?? '서명란'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <FileText size={40} className="opacity-20" />
            <p className="text-xs font-medium">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};
