import { useRef, useState } from 'react';
import type { ChangeEvent, FC, FormEvent, ReactNode } from 'react';
import { CircleX, Key, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { CeremonyResultType, DocumentVerificationResult } from '../types';

const RESULT_TYPE_LABEL: Record<CeremonyResultType, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

/**
 * 결과 PDF 위변조 검증(공개, JWT 없음, `/verify`). `POST /api/verification/documents`에 파일을
 * 그대로 올린다 — 정확한 바이트열을 가진 사람만 통과하는 체크섬 대조라 로그인 없이 열어도
 * 안전하다(signstage-backend 8라운드 결정). 실패하면 신원 정보가 전혀 없다 — 백엔드가 애초에
 * `verified:false`일 때 다른 필드를 전부 `null`로 준다.
 *
 * `SignerPortalView`와 같은 독립 카드 레이아웃을 쓰지만 별개 라우트다 — 대상이 accessKey
 * 소지자가 아니라 "이 파일을 가진 아무나"라 관심사가 다르다.
 */
export const DocumentVerificationView: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (selected && selected.type !== 'application/pdf') {
      showSnackbar('PDF 파일만 확인할 수 있습니다.', 'error');
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      showSnackbar('확인할 PDF 파일을 선택해주세요.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsVerifying(true);
    try {
      const response = await api.post('/verification/documents', formData);
      setResult(response.data as DocumentVerificationResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : '진위 확인에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <PortalShell>
      {result ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {result.verified ? (
            <>
              <ShieldCheck size={40} className="text-emerald-500" />
              <p className="text-base font-bold text-gray-950">진짜 결과 문서입니다</p>
              <div className="mt-2 w-full bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-100 text-left">
                <DetailRow label="문서 종류" value={result.resultType ? RESULT_TYPE_LABEL[result.resultType] : '-'} />
                <DetailRow label="행사" value={result.ceremonyTitle ?? '-'} />
                <DetailRow label="하위 행사" value={result.eventName ?? '-'} />
                <DetailRow
                  label="생성 시각"
                  value={result.generatedAt ? formatDateTime(result.generatedAt) : '-'}
                />
              </div>
            </>
          ) : (
            <>
              <CircleX size={40} className="text-gray-400" />
              <p className="text-base font-bold text-gray-950">확인할 수 없는 문서입니다</p>
              <p className="text-sm text-gray-500">SignStage에서 생성된 결과 문서와 일치하지 않습니다.</p>
            </>
          )}
          <button
            onClick={handleReset}
            className="mt-4 w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm text-sm"
          >
            다른 파일 확인
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6 text-center">
            <h1 className="text-lg font-bold text-gray-950">결과 문서 진위 확인</h1>
            <p className="mt-1 text-xs text-gray-500">SignStage에서 발급한 서명 결과 PDF가 맞는지 확인합니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={isVerifying}
              className="w-full text-sm text-gray-600 file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:text-xs file:font-medium file:bg-white hover:file:border-gray-400"
            />
            <button
              type="submit"
              disabled={isVerifying}
              className="flex items-center justify-center gap-1.5 w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
            >
              {isVerifying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {isVerifying ? '확인 중...' : '진위 확인'}
            </button>
          </form>
        </>
      )}
    </PortalShell>
  );
};

const PortalShell: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-center gap-2 mb-6 text-gray-400">
        <Key size={16} />
        <span className="text-xs font-medium">SignStage 문서 진위 확인</span>
      </div>
      {children}
    </div>
  </div>
);

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-3 px-3 py-2">
    <span className="w-20 shrink-0 text-xs font-medium text-gray-500">{label}</span>
    <span className="text-sm text-gray-950">{value}</span>
  </div>
);
