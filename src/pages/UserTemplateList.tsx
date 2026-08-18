import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Upload } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { TemplateDocumentRole, TemplateStatus, TemplateSummary } from '../types';

const DOCUMENT_ROLE_LABEL: Record<TemplateDocumentRole, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };
const STATUS_LABEL: Record<TemplateStatus, string> = { DRAFT: '작성 중', COMPLETED: '완료' };

/**
 * 문서 양식(Template) 관리(`/org/ceremonies/:organizationId/:ceremonyId/templates`). 목록과
 * 업로드 폼을 한 화면에 둔다(UserSignerList와 같은 패턴). 업로드는 multipart라 JSON이 아니라
 * `FormData`로 보낸다 — `api.post`가 `FormData`면 `Content-Type`을 자동으로 비워 브라우저가
 * boundary를 채우게 한다(1라운드 조사에서 확인한 기존 동작).
 */
export const UserTemplateList: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isUploadFormOpen, setIsUploadFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [documentRole, setDocumentRole] = useState<TemplateDocumentRole>('CONTRACT');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  const fetchTemplates = async () => {
    const response = await api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/templates`);
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
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== 'application/pdf') {
      showSnackbar('PDF 파일만 업로드할 수 있습니다.', 'error');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showSnackbar('문서 제목을 입력해주세요.', 'error');
      return;
    }
    if (!file) {
      showSnackbar('업로드할 PDF 파일을 선택해주세요.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('documentRole', documentRole);
    formData.append('file', file);

    setIsUploading(true);
    try {
      await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/templates`, formData);
      showSnackbar('문서 양식을 업로드했습니다.', 'success');
      setTitle('');
      setDocumentRole('CONTRACT');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadFormOpen(false);
      setTemplates(await fetchTemplates());
    } catch (err) {
      const message = err instanceof Error ? err.message : '문서 양식 업로드에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <Link to={detailPath} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        행사 상세로
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <FileText size={20} className="text-gray-400" />
            문서 양식 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">PDF 문서를 올리고, 문서 위에 서명란을 배치합니다.</p>
        </div>
        {!isUploadFormOpen && (
          <button
            onClick={() => setIsUploadFormOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-gray-950 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
            문서 업로드
          </button>
        )}
      </div>

      {isUploadFormOpen && (
        <form
          onSubmit={handleUpload}
          className="mb-4 bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">문서 유형</label>
            <select
              value={documentRole}
              onChange={(e) => setDocumentRole(e.target.value as TemplateDocumentRole)}
              disabled={isUploading}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none bg-white"
            >
              <option value="CONTRACT">계약서</option>
              <option value="EXHIBITION">전시문서</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">PDF 파일</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="text-sm text-gray-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:border-gray-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              <Upload size={12} />
              {isUploading ? '업로드 중...' : '업로드'}
            </button>
            <button
              type="button"
              onClick={() => setIsUploadFormOpen(false)}
              disabled={isUploading}
              className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:border-gray-400 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={templates.length === 0} emptyMessage="아직 업로드된 문서 양식이 없습니다.">
        <ul className="divide-y divide-gray-100">
          {templates.map((template) => (
            <li key={template.id}>
              <Link
                to={`${detailPath}/templates/${template.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <FileText size={16} className="text-gray-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-950 truncate">{template.title}</p>
                  <p className="text-xs text-gray-500">
                    {DOCUMENT_ROLE_LABEL[template.documentRole]} · {template.originalFilename}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{STATUS_LABEL[template.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ListContainer>
    </div>
  );
};
