import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC, FormEvent, MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { SignerSummary, TemplateFieldSummary, TemplateSummary } from '../types';

// Vite 환경에서 pdfjs 워커를 정적 자산으로 잡는 표준 패턴이다 — 별도 복사 플러그인이 필요 없다.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const PAGE_WIDTH = 700;
/** 클릭 지점을 중심으로 놓는 기본 서명란 크기(페이지 기준 비율). 드래그로 크기를 바꾸는 건 다음 다듬기로 미룬다. */
const DEFAULT_WIDTH_RATIO = 0.15;
const DEFAULT_HEIGHT_RATIO = 0.05;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * 서명란(TemplateField) 배치 화면. 원본 PDF를 인증이 필요한 바이너리로 받아(`api.getBlob`)
 * blob URL을 만들고 `react-pdf`로 렌더링한 뒤, 그 위에 절대위치 오버레이로 기존 서명란을
 * 그리고 빈 곳 클릭으로 새 서명란을 추가한다.
 *
 * 좌표는 전부 페이지 기준 0~1 비율, 좌상단 원점이다(signstage-backend
 * feature.ceremony.support.SignatureOverlayRenderer와 같은 좌표계) — 오버레이를 CSS
 * 퍼센트로 그리고, 클릭 위치는 오버레이 컨테이너의 `getBoundingClientRect()`로 비율 환산하므로
 * 렌더링 폭(PAGE_WIDTH)이 실제 페이지 크기와 달라도 항상 정확하다.
 */
export const UserTemplateDetail: FC = () => {
  const { organizationId, ceremonyId, templateId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    templateId: string;
  }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);

  const [fields, setFields] = useState<TemplateFieldSummary[]>([]);
  const [signers, setSigners] = useState<SignerSummary[]>([]);

  const [pendingPoint, setPendingPoint] = useState<{ xRatio: number; yRatio: number } | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingRequired, setPendingRequired] = useState(true);
  const [pendingSignerId, setPendingSignerId] = useState<number | ''>('');
  const [isCreatingField, setIsCreatingField] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;
  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(`${basePath}/templates/${templateId}`);
        if (!cancelled) {
          setTemplate(response.data as TemplateSummary);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '문서 양식 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
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
  }, [organizationId, ceremonyId, templateId]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await api.getBlob(`${basePath}/templates/${templateId}/file`);
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setFileBlobUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'PDF 원본을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsFileLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, templateId]);

  const fetchFields = async () => {
    const response = await api.get(`${basePath}/templates/${templateId}/fields`);
    return response.data as TemplateFieldSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [fieldsData, signersRes] = await Promise.all([
          fetchFields(),
          api.get(`${basePath}/signers`),
        ]);
        if (!cancelled) {
          setFields(fieldsData);
          setSigners(signersRes.data as SignerSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '서명란/서명자 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, templateId]);

  const currentPageIndex = pageNumber - 1;
  const fieldsOnPage = useMemo(() => fields.filter((field) => field.pageIndex === currentPageIndex), [fields, currentPageIndex]);
  const signerName = (signerId: number | null) => signers.find((signer) => signer.id === signerId)?.name ?? null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (pendingPoint) return; // 이미 입력 중인 서명란이 있으면 새로 시작하지 않는다.
    const rect = e.currentTarget.getBoundingClientRect();
    const clickXRatio = (e.clientX - rect.left) / rect.width;
    const clickYRatio = (e.clientY - rect.top) / rect.height;

    const xRatio = clamp(clickXRatio - DEFAULT_WIDTH_RATIO / 2, 0, 1 - DEFAULT_WIDTH_RATIO);
    const yRatio = clamp(clickYRatio - DEFAULT_HEIGHT_RATIO / 2, 0, 1 - DEFAULT_HEIGHT_RATIO);
    setPendingPoint({ xRatio, yRatio });
    setPendingName('');
    setPendingRequired(true);
    setPendingSignerId('');
  };

  const handleCreateField = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingPoint) return;
    if (!pendingName.trim()) {
      showSnackbar('서명란 이름을 입력해주세요.', 'error');
      return;
    }

    setIsCreatingField(true);
    try {
      await api.post(`${basePath}/templates/${templateId}/fields`, {
        fieldKey: `field-${currentPageIndex}-${fields.length}`,
        pageIndex: currentPageIndex,
        fieldIndex: fields.length,
        fieldName: pendingName.trim(),
        roleCode: null,
        signOrder: null,
        isRequired: pendingRequired,
        signerId: pendingSignerId === '' ? null : pendingSignerId,
        xRatio: pendingPoint.xRatio,
        yRatio: pendingPoint.yRatio,
        widthRatio: DEFAULT_WIDTH_RATIO,
        heightRatio: DEFAULT_HEIGHT_RATIO,
      });
      showSnackbar('서명란을 추가했습니다.', 'success');
      setPendingPoint(null);
      setFields(await fetchFields());
    } catch (err) {
      const message = err instanceof Error ? err.message : '서명란 추가에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsCreatingField(false);
    }
  };

  const handleDownload = async () => {
    if (!template) return;
    try {
      const blob = await api.getBlob(`${basePath}/templates/${templateId}/file`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : '파일 다운로드에 실패했습니다.';
      showSnackbar(message, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div>
      <Link to={`${detailPath}/templates`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        문서 양식 목록으로
      </Link>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <FileText size={20} className="text-gray-400" />
          {template.title}
        </h1>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400"
        >
          <Download size={14} />
          원본 다운로드
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        문서 위 빈 곳을 클릭해 서명란을 추가하세요. 기본 크기로 놓이며, 이름과 배정 서명자를 바로 입력할 수 있습니다.
      </p>

      {isFileLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : fileBlobUrl ? (
        <div>
          <Document
            file={fileBlobUrl}
            onLoadSuccess={({ numPages: total }) => setNumPages(total)}
            onLoadError={() => showSnackbar('PDF를 렌더링하지 못했습니다.', 'error')}
            loading={
              <div className="flex items-center justify-center py-24 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            }
          >
            <div className="relative inline-block border border-gray-200 rounded-lg overflow-hidden">
              <Page pageNumber={pageNumber} width={PAGE_WIDTH} renderTextLayer={false} renderAnnotationLayer={false} />
              <div
                ref={overlayRef}
                onClick={handleOverlayClick}
                className="absolute inset-0 cursor-crosshair"
              >
                {fieldsOnPage.map((field) => {
                  const assigned = signerName(field.signerId);
                  return (
                    <div
                      key={field.id}
                      className={`absolute pointer-events-none border-2 rounded flex items-center justify-center text-[10px] font-medium px-1 text-center ${
                        assigned ? 'border-blue-500 bg-blue-500/10 text-blue-700' : 'border-gray-400 border-dashed bg-gray-400/10 text-gray-600'
                      }`}
                      style={{
                        left: `${field.xRatio * 100}%`,
                        top: `${field.yRatio * 100}%`,
                        width: `${field.widthRatio * 100}%`,
                        height: `${field.heightRatio * 100}%`,
                      }}
                    >
                      <span className="truncate">
                        {field.fieldName}
                        {assigned ? ` · ${assigned}` : ''}
                      </span>
                    </div>
                  );
                })}

                {pendingPoint && (
                  <div
                    className="absolute border-2 border-emerald-500 border-dashed bg-emerald-500/10 rounded"
                    style={{
                      left: `${pendingPoint.xRatio * 100}%`,
                      top: `${pendingPoint.yRatio * 100}%`,
                      width: `${DEFAULT_WIDTH_RATIO * 100}%`,
                      height: `${DEFAULT_HEIGHT_RATIO * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </Document>

          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600">
              {pageNumber} / {numPages || '-'}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="p-1.5 rounded-md border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {pendingPoint && (
            <form
              onSubmit={handleCreateField}
              className="mt-4 max-w-sm bg-white border border-emerald-200 rounded-lg p-4 flex flex-col gap-3"
            >
              <p className="text-xs font-medium text-emerald-700">새 서명란</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">이름</label>
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  disabled={isCreatingField}
                  autoFocus
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
                  placeholder="예: 대표자 서명"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">배정 서명자</label>
                <select
                  value={pendingSignerId}
                  onChange={(e) => setPendingSignerId(e.target.value ? Number(e.target.value) : '')}
                  disabled={isCreatingField}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
                >
                  <option value="">미배정</option>
                  {signers.map((signer) => (
                    <option key={signer.id} value={signer.id}>
                      {signer.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={pendingRequired}
                  onChange={(e) => setPendingRequired(e.target.checked)}
                  disabled={isCreatingField}
                />
                필수 서명란
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingField}
                  className="flex-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isCreatingField ? '추가 중...' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPoint(null)}
                  disabled={isCreatingField}
                  className="flex-1 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-gray-500">PDF를 불러올 수 없습니다.</p>
      )}
    </div>
  );
};
