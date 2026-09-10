import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Key, LogOut, Monitor, PenTool } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { DemoScenario } from '../types';

/**
 * 데모 체험 계정(VIEWER) 전용 단일 화면(`/demo`) — signstage-docs
 * business/demo-account-exhibition-signer-preview-review.md 4.2절 결정(2026-09-10 구현).
 * `UserLayout`/`AdminLayout`과 같은 header+sidebar 구조를 흉내 내지 않고 사이드바 없는
 * 단일 화면으로 둔다. 목록 → 상세(버튼 2개) 구조 — 항목을 클릭하면 그 아래 "전시용 화면"/
 * "서명자용 화면" 버튼 2개가 펼쳐진다. 둘 다 QR·복사 모달 없이 단순 링크를 새 탭으로 여는
 * 것뿐이다(4.2절 최종 결정, 2026-08-30).
 */
export const DemoView: FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [scenarios, setScenarios] = useState<DemoScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/demo-viewer/scenarios');
        if (!cancelled) setScenarios(response.data as DemoScenario[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '데모 목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenProjector = (eventAccessKey: string) => {
    window.open(`/projector/${eventAccessKey}`, '_blank', 'noopener,noreferrer');
  };

  /**
   * 새 탭을 열기 직전에 이 서명자의 서명란을 전부 지운다 — 방문자가 "다시 그리기"를 직접
   * 챙기지 않아도 항상 깨끗한 상태로 시작하게 한다(5.2절 결정). 리셋이 실패해도(예: 아직
   * 아무도 서명 안 해 지울 게 없는 경우 등) 체험 자체를 막지 않는다 — 그냥 조용히 열어준다.
   */
  const handleOpenSignerView = async (scenario: DemoScenario) => {
    setIsResetting(true);
    try {
      await api.delete(`/portal/events/${scenario.eventAccessKey}/signers/${scenario.signerAccessKey}/strokes`);
    } catch {
      // 리셋 실패는 무시한다 — 체험 자체는 계속 진행한다.
    } finally {
      setIsResetting(false);
    }
    window.open(`/portal/${scenario.eventAccessKey}/${scenario.signerAccessKey}`, '_blank', 'noopener,noreferrer');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gray-950 p-1.5 text-white">
              <Key size={18} />
            </div>
            <span className="text-sm font-bold">SignStage 데모</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-400 hover:text-gray-950"
          >
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-bold text-gray-950">실제 서명식 화면이 어떻게 동작하는지 확인해보세요</h1>
          <p className="mt-2 text-sm text-gray-500">
            아래 목록에서 데모를 선택하면 전시용(프로젝터) 화면과 서명자용 화면을 새 탭으로 열 수 있습니다.
          </p>
        </div>

        {isLoading ? (
          <p className="text-center text-sm text-gray-400">불러오는 중...</p>
        ) : scenarios.length === 0 ? (
          <p className="text-center text-sm text-gray-400">지금 체험할 수 있는 데모가 없습니다. 잠시 후 다시 시도해주세요.</p>
        ) : (
          <div className="space-y-3">
            {scenarios.map((scenario) => {
              const isOpen = openId === scenario.ceremonyEventId;
              return (
                <div
                  key={scenario.ceremonyEventId}
                  className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : scenario.ceremonyEventId)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="text-sm font-bold text-gray-950">{scenario.title}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-5 py-4">
                      <button
                        onClick={() => handleOpenProjector(scenario.eventAccessKey)}
                        className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 py-5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-950"
                      >
                        <Monitor size={22} />
                        전시용 화면 열기
                        <span className="text-[11px] font-normal text-gray-400">새 탭으로 열림</span>
                      </button>
                      <button
                        onClick={() => handleOpenSignerView(scenario)}
                        disabled={isResetting}
                        className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 py-5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-950 disabled:opacity-50"
                      >
                        <PenTool size={22} />
                        서명자용 화면
                        <span className="text-[11px] font-normal text-gray-400">새 탭으로 열림</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
