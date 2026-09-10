import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Check, Copy, Link as LinkIcon, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../components/Button';
import { ListContainer } from '../components/ListContainer';
import { useAuthStore } from '../store/useAuthStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import { canManagePlatform } from '../utils/permissions';
import type { DemoConfigSummary, DemoEventOption, UpsertDemoConfigRequest } from '../types';

const EMPTY_DRAFT = (): UpsertDemoConfigRequest => ({
  slug: '',
  eventAccessKey: '',
  signerAccessKeys: [],
  enabled: true,
});

/**
 * 체험형 데모 URL 관리(`/admin/demo-configs`) — signstage-docs
 * business/demo-account-exhibition-signer-preview-review.md 13장 결정(2026-09-10). 데모 조직
 * 소속 행사 + 서명자(들)를 골라 slug 하나를 발급하면, legacy 데모 사이트
 * (`demo-signstage-frontend`, 별도 저장소/도메인, 이 화면은 건드리지 않는다)가
 * `/demo/{slug}`로 그 조합을 그대로 보여준다 — 이 화면은 "체험용 행사 조합 + 공유할 URL"을
 * 만드는 역할만 한다. 실제 방문 URL의 도메인은 이 프로젝트가 모른다(데모 사이트가 별도로
 * 배포되므로) — slug만 만들어주고, 그 앞에 데모 사이트 도메인을 붙여 공유하도록 안내한다.
 */
export const AdminDemoConfigList: FC = () => {
  const [configs, setConfigs] = useState<DemoConfigSummary[]>([]);
  const [eventOptions, setEventOptions] = useState<DemoEventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<UpsertDemoConfigRequest>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const currentPlatformRole = useAuthStore((state) => state.platformAdmin?.platformRole);
  const canManage = canManagePlatform(currentPlatformRole);
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const fetchAll = async () => {
    const [configsResponse, eventOptionsResponse] = await Promise.all([
      api.get('/platform-admin/demo-configs'),
      api.get('/platform-admin/demo-configs/event-options'),
    ]);
    setConfigs(configsResponse.data as DemoConfigSummary[]);
    setEventOptions(eventOptionsResponse.data as DemoEventOption[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchAll();
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = eventOptions.find((event) => event.eventAccessKey === draft.eventAccessKey) ?? null;

  const openCreateForm = () => {
    setDraft(EMPTY_DRAFT());
    setIsFormOpen(true);
  };

  const toggleSigner = (signerAccessKey: string) => {
    setDraft((prev) => ({
      ...prev,
      signerAccessKeys: prev.signerAccessKeys.includes(signerAccessKey)
        ? prev.signerAccessKeys.filter((key) => key !== signerAccessKey)
        : [...prev.signerAccessKeys, signerAccessKey],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.slug.trim() || !draft.eventAccessKey || draft.signerAccessKeys.length === 0) {
      showSnackbar('식별자·행사·서명자를 모두 선택해주세요.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await api.put('/platform-admin/demo-configs', { ...draft, slug: draft.slug.trim() });
      showSnackbar('데모 프로필을 저장했습니다.', 'success');
      setIsFormOpen(false);
      await fetchAll();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      await api.delete(`/platform-admin/demo-configs/${slug}`);
      showSnackbar('데모 프로필을 삭제했습니다.', 'success');
      await fetchAll();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    } finally {
      setDeletingSlug(null);
    }
  };

  const handleCopyPath = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`/demo/${slug}`);
      showSnackbar('경로를 복사했습니다. 데모 사이트 도메인 뒤에 붙여 공유해주세요.', 'success');
    } catch {
      showSnackbar('클립보드 복사에 실패했습니다.', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <LinkIcon size={20} className="text-gray-400" />
            체험 데모 URL 관리
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            데모 조직 소속 행사 + 서명자(들)를 골라 식별자(slug)를 발급합니다. 실제 체험 URL은 데모 사이트(별도 도메인)의
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">/demo/&#123;slug&#125;</code>
            경로입니다.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateForm}>
            <Plus size={16} />
            새로 만들기
          </Button>
        )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-950">데모 프로필 만들기</h2>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-950">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">식별자(slug)</label>
              <input
                type="text"
                value={draft.slug}
                onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                disabled={isSaving}
                placeholder="예: seoul-booth"
                className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all"
              />
              <p className="mt-1 text-[11px] text-gray-400">영문 소문자, 숫자, 하이픈(-)만. 이미 있는 slug면 그 프로필을 덮어씁니다.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">행사</label>
              <select
                value={draft.eventAccessKey}
                onChange={(e) => setDraft((prev) => ({ ...prev, eventAccessKey: e.target.value, signerAccessKeys: [] }))}
                disabled={isSaving}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all bg-white"
              >
                <option value="">선택해주세요</option>
                {eventOptions.map((event) => (
                  <option key={event.eventAccessKey} value={event.eventAccessKey}>
                    {event.ceremonyTitle} — {event.eventName}
                  </option>
                ))}
              </select>
              {eventOptions.length === 0 && (
                <p className="mt-1 text-[11px] text-gray-400">데모 조직 소속 행사가 없습니다. "데모 행사 관리"에서 먼저 만들어주세요.</p>
              )}
            </div>
          </div>

          {selectedEvent && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                서명자(최대 2명까지만 나란히 보여집니다 — 데모 사이트 제약)
              </label>
              {selectedEvent.signers.length === 0 ? (
                <p className="text-xs text-gray-400">이 행사에 등록된 서명자가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedEvent.signers.map((signer) => (
                    <label key={signer.signerAccessKey} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={draft.signerAccessKeys.includes(signer.signerAccessKey)}
                        onChange={() => toggleSigner(signer.signerAccessKey)}
                        disabled={isSaving}
                      />
                      {signer.name}
                      {signer.affiliation && <span className="text-xs text-gray-400">({signer.affiliation})</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.enabled ?? true}
              onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
              disabled={isSaving}
            />
            공개(체험 목록에 노출)
          </label>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      )}

      <ListContainer isLoading={isLoading} isEmpty={configs.length === 0} emptyMessage="등록된 데모 프로필이 없습니다.">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">식별자</th>
              <th className="text-left px-4 py-3 font-medium">서명자 수</th>
              <th className="text-left px-4 py-3 font-medium">공개 여부</th>
              <th className="text-left px-4 py-3 font-medium">갱신일</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {configs.map((config) => (
              <tr key={config.slug}>
                <td className="px-4 py-3 font-mono text-xs font-medium text-gray-950">{config.slug}</td>
                <td className="px-4 py-3 text-gray-600">{config.signerAccessKeys.length}명</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      config.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {config.enabled ? <Check size={11} /> : <X size={11} />}
                    {config.enabled ? '공개' : '비공개'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(config.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleCopyPath(config.slug)}>
                      <Copy size={12} />
                      경로 복사
                    </Button>
                    {canManage && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(config.slug)}
                        disabled={deletingSlug === config.slug}
                      >
                        <Trash2 size={12} />
                        삭제
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>
      {!canManage && <p className="mt-2 text-xs text-gray-400">생성/삭제는 PLATFORM_OPS 이상만 가능합니다. (조회 전용 계정)</p>}
    </div>
  );
};
