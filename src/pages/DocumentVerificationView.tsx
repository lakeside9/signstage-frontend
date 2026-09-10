import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FC } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { CeremonyResultType, DocumentVerificationResult } from '../types';

const RESULT_TYPE_LABEL: Record<CeremonyResultType, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

const isPdf = (file: File) => file.type === 'application/pdf';

/**
 * 결과 PDF 위변조 검증(공개, JWT 없음, `/verify`) — signstage-docs
 * business/ceremony-feature-migration-review.md §8.13(2026-09-10). 화면 구성은 legacy
 * (`~/Works/eform/source/signstage/signstage-frontend` `VerifyAuthenticity.tsx`)를 참고해
 * 다시 짰다 — 드래그앤드롭 업로드 영역, 파일 미리보기 카드, 결과 카드, 하단 안내 박스 구성은
 * legacy와 같은 틀이다.
 *
 * <p>다만 검증 원리 자체는 legacy와 다르다 — legacy는 PDF에 내장된 PKCS#7 디지털 서명을
 * 파싱해 서명자별로 여러 건을 검증하지만(`POST /digital-signature/verify`, 배열 응답), 이
 * 프로젝트는 서버가 생성한 결과물의 SHA-256 체크섬과 그대로 대조하는 방식이다(`POST
 * /api/verification/documents`, 단건 응답) — "정확한 바이트열을 가진 사람만 통과"하는 원리라
 * 로그인 없이 열어도 안전하다. 그래서 결과 영역은 legacy처럼 서명자별 카드 목록이 아니라 단일
 * 결과 카드 하나다.
 */
export const DocumentVerificationView: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);

  const applyFile = (candidate: File) => {
    if (!isPdf(candidate)) {
      showSnackbar('PDF 파일만 확인할 수 있습니다.', 'error');
      return;
    }
    setFile(candidate);
    setResult(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) applyFile(selected);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) applyFile(dropped);
  };

  const handleVerify = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    setIsVerifying(true);
    try {
      const response = await api.post('/verification/documents', formData);
      setResult(response.data as DocumentVerificationResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : '진위 확인 중 오류가 발생했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <div className="rounded-lg bg-gray-950 p-1.5 text-white">
            <ShieldCheck size={18} />
          </div>
          <span className="text-sm font-bold text-gray-950">SignStage 문서 진위 확인</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <div className="mb-2 flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-gray-900">진위여부 검증하기</h1>
          <p className="text-gray-500">SignStage에서 생성된 결과 PDF가 맞는지, 서명 이후 변경되지 않았는지 확인합니다.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-8">
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-all ${
                  isDragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors group-hover:text-gray-600">
                  <Upload size={32} />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">검증할 PDF 파일을 업로드하세요</p>
                  <p className="mt-1 text-sm text-gray-500">클릭하거나 파일을 여기로 끌어다 놓으세요</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="max-w-xs truncate font-bold text-gray-900 sm:max-w-md">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={reset} disabled={isVerifying} className="text-sm font-medium text-gray-500 hover:text-gray-900">
                    파일 변경
                  </button>
                </div>

                {!result && (
                  <button
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 py-4 font-bold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        확인 중...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        진위여부 검증 시작
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {result && (
              <div className="mt-12 space-y-6 border-t border-gray-100 pt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">검증 결과</h2>
                  <button onClick={reset} className="text-sm font-medium text-gray-500 hover:text-gray-950">
                    새로 검증하기
                  </button>
                </div>

                {result.verified ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-emerald-900">진짜 결과 문서입니다</p>
                        <p className="mt-1 text-sm text-emerald-700">SignStage가 생성한 결과 문서와 바이트 단위로 일치합니다.</p>
                        <div className="mt-4 space-y-1">
                          <DetailRow label="문서 종류" value={result.resultType ? RESULT_TYPE_LABEL[result.resultType] : '-'} />
                          <DetailRow label="행사" value={result.ceremonyTitle ?? '-'} />
                          <DetailRow label="하위 행사" value={result.eventName ?? '-'} />
                          <DetailRow label="생성 시각" value={result.generatedAt ? formatDateTime(result.generatedAt) : '-'} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <XCircle size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-red-900">확인할 수 없는 문서입니다</p>
                        <p className="mt-1 text-sm text-red-700">SignStage에서 생성된 결과 문서와 일치하지 않습니다.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-gray-100 p-6 text-sm text-gray-600">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-950">
            <AlertCircle size={18} />
            진위여부 확인 안내
          </h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>업로드된 파일은 검증 목적으로만 사용되며 서버에 저장되지 않습니다.</li>
            <li>SignStage가 실제로 생성한 결과 문서와 파일 내용이 정확히 일치하는지(체크섬 대조)로 진위를 확인합니다.</li>
            <li>생성 이후 문서 내용이 단 1바이트라도 바뀌면 검증 결과는 "확인할 수 없는 문서"로 표시됩니다.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex text-sm">
    <span className="w-24 shrink-0 text-emerald-600">{label}</span>
    <span className="font-medium text-emerald-950">{value}</span>
  </div>
);
