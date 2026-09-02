import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { Copy, ExternalLink, Loader2, QrCode, RefreshCw, X } from 'lucide-react';
import { api } from '../utils/api';
import { useSnackbarStore } from '../store/useSnackbarStore';
import type { CeremonyEventSummary, CeremonyEventType, SignerCompletionStatus, SignerSummary } from '../types';

/**
 * 헤더 상단 영역 배경/뱃지 색상 — 테스트/리허설/본행사를 한눈에 구분하기 위한 것.
 * `UserCeremonyEventControl.tsx`의 EVENT_TYPE_CONTROL_META와 같은 값을 쓴다(2026-09-02 legacy
 * 포팅 — ~/Works/eform/source/signstage/signstage-frontend `SignerPortalQrWindow.tsx` 참고).
 */
const EVENT_TYPE_CONTROL_META: Record<CeremonyEventType, { label: string; headerClassName: string; badgeClassName: string }> = {
  TEST: {
    label: '테스트',
    headerClassName: 'bg-gray-100 border-gray-300',
    badgeClassName: 'border-gray-300 bg-white/85 text-gray-800',
  },
  REHEARSAL: {
    label: '리허설',
    headerClassName: 'bg-sky-100 border-sky-300',
    badgeClassName: 'border-sky-300 bg-white/90 text-sky-900',
  },
  MAIN: {
    label: '본행사',
    headerClassName: 'bg-indigo-100 border-indigo-300',
    badgeClassName: 'border-indigo-300 bg-white/90 text-indigo-900',
  },
};

const PortalQrCode: FC<{ value: string }> = ({ value }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 288, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="h-44 w-44 animate-pulse rounded-lg bg-gray-100" />;
  }
  return <img src={dataUrl} alt="서명자 입장 QR 코드" className="h-44 w-44" />;
};

/**
 * 행사제어 화면(UserCeremonyEventControl.tsx)의 "서명자 포털 (QR)" 팝업 모달을 새 창 전용
 * 화면으로 분리한 것 — legacy(~/Works/eform/source/signstage/signstage-frontend)
 * `SignerPortalQrWindow.tsx`와 같은 목적이다. 행사제어 화면이 `window.open`으로 이 경로를
 * 새 창으로 띄운다. "매핑된 서명자"는 행사제어 화면과 같은 기준(GET .../signature-status —
 * `POST .../finish`가 실제로 검사하는 것과 같은 필수 서명자 집합)으로 걸러낸다.
 */
export const UserSignerPortalQrWindow: FC = () => {
  const { organizationId, ceremonyId, eventId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    eventId: string;
  }>();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [event, setEvent] = useState<CeremonyEventSummary | null>(null);
  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [signatureStatuses, setSignatureStatuses] = useState<SignerCompletionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // "새로고침" 버튼이 값을 바꿔 아래 effect를 다시 돌린다 — effect 안에서 조회 함수를 이름으로
  // 부르는 대신(react-hooks/set-state-in-effect가 그 패턴을 cascading render 위험으로 본다)
  // 매번 즉시실행 함수로 인라인해 두는 이 저장소 관례(UserCeremonyEdit.tsx 등)를 따른다.
  const [refreshToken, setRefreshToken] = useState(0);

  const apiBasePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}/events/${eventId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        const [eventRes, signersRes, statusRes] = await Promise.all([
          api.get(apiBasePath),
          api.get(`/organizations/${organizationId}/ceremonies/${ceremonyId}/signers`),
          api.get(`${apiBasePath}/signature-status`),
        ]);
        if (cancelled) return;
        setEvent(eventRes.data as CeremonyEventSummary);
        setSigners(signersRes.data as SignerSummary[]);
        setSignatureStatuses(statusRes.data as SignerCompletionStatus[]);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'QR 정보를 불러오는데 실패했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBasePath, ceremonyId, organizationId, refreshToken]);

  const copyPortalUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showSnackbar('링크를 복사했습니다.', 'success');
    } catch {
      showSnackbar('링크 복사에 실패했습니다.', 'error');
    }
  };

  const mappedSignerIds = new Set(signatureStatuses.map((status) => status.signerId));
  const mappedSigners = signers.filter((signer) => mappedSignerIds.has(signer.id));

  const eventTypeMeta = event ? EVENT_TYPE_CONTROL_META[event.eventType] : null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 text-gray-950">
      <header
        className={`sticky top-0 z-10 border-b px-6 py-4 shadow-sm backdrop-blur ${
          eventTypeMeta ? eventTypeMeta.headerClassName : 'border-gray-200 bg-white/95'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {eventTypeMeta && (
                <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black ${eventTypeMeta.badgeClassName}`}>
                  {eventTypeMeta.label}
                </span>
              )}
              <h1 className="truncate text-2xl font-black text-gray-900">
                서명자 입장 포탈 <span className="font-medium text-gray-400">-</span> {event?.name ?? 'QR'}
              </h1>
            </div>
            <p className="mt-1 text-sm font-medium text-gray-500">QR 코드를 스캔하면 서명자 포털로 바로 이동합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshToken((token) => token + 1)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              새로고침
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              className="rounded-lg bg-gray-900 p-2 text-white transition-colors hover:bg-gray-800"
              title="창 닫기"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 lg:p-10">
        {isLoading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-gray-500">
            <Loader2 className="mb-3 animate-spin text-gray-300" size={40} />
            <p className="text-sm font-medium">QR 정보를 불러오는 중입니다.</p>
          </div>
        ) : !event || mappedSigners.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white text-center text-gray-500">
            <QrCode className="mb-3 text-gray-300" size={42} />
            <p className="text-base font-bold">생성할 QR 정보가 없습니다.</p>
            <p className="mt-1 text-sm text-gray-400">서명란에 매핑된 서명자가 있는지 확인해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {mappedSigners.map((signer) => {
              const portalUrl = `${window.location.origin}/portal/${event.accessKey}/${signer.accessKey}`;
              return (
                <div
                  key={signer.id}
                  className="group flex flex-col items-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg"
                >
                  <div className="mb-4 rounded-lg bg-gray-50 p-3 transition-colors group-hover:bg-indigo-50">
                    <PortalQrCode value={portalUrl} />
                  </div>
                  <div className="text-sm font-bold text-gray-900">{signer.name}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyPortalUrl(portalUrl)}
                      className="flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      <Copy size={13} />
                      링크 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(portalUrl, '_blank')}
                      className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                    >
                      <ExternalLink size={13} />
                      포털 열기
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default UserSignerPortalQrWindow;
