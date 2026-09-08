import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, Loader2, Plus } from 'lucide-react';
import { ListContainer } from '../components/ListContainer';
import { SearchBar, SearchField } from '../components/SearchBar';
import { EffectPreviewDialog } from '../components/effects/preview/EffectPreviewDialog';
import type { EffectPreviewDefinition } from '../components/effects/preview/EffectPreviewStage';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/internationalization';
import type { CeremonyEffectDefinition, CeremonyEffectTarget, CeremonyEffectTrigger, PageResponse } from '../types';

const PAGE_SIZE = 20;

const TARGET_LABEL: Record<CeremonyEffectTarget, string> = { PROJECTOR: '프로젝터 화면', SIGNER: '서명자 화면' };
const TRIGGER_LABEL: Record<CeremonyEffectTrigger, string> = {
  SIGNATURE_COMPLETED: '개별 서명 완료',
  ALL_SIGNATURES_COMPLETED: '전체 서명 완료',
  EVENT_FINISHED: '행사 종료',
};

interface SearchParams {
  keyword: string;
  targetType: CeremonyEffectTarget | 'ALL';
  triggerType: CeremonyEffectTrigger | 'ALL';
  enabled: 'ALL' | 'true' | 'false';
  userVisible: 'ALL' | 'true' | 'false';
}

const EMPTY_SEARCH: SearchParams = { keyword: '', targetType: 'ALL', triggerType: 'ALL', enabled: 'ALL', userVisible: 'ALL' };

const buildQuery = (search: SearchParams, page: number) => {
  const query = new URLSearchParams();
  if (search.keyword.trim()) query.set('keyword', search.keyword.trim());
  if (search.targetType !== 'ALL') query.set('targetType', search.targetType);
  if (search.triggerType !== 'ALL') query.set('triggerType', search.triggerType);
  if (search.enabled !== 'ALL') query.set('enabled', search.enabled);
  if (search.userVisible !== 'ALL') query.set('userVisible', search.userVisible);
  query.set('page', String(page));
  query.set('size', String(PAGE_SIZE));
  return query;
};

const fetchDefinitions = async (search: SearchParams, page: number) => {
  const response = await api.get(`/platform-admin/ceremony-effects?${buildQuery(search, page)}`);
  return response.data as PageResponse<CeremonyEffectDefinition>;
};

/** 위/아래 이동 버튼의 그룹키(같은 target+trigger만 서로 순서를 바꿀 수 있다). */
const groupKey = (definition: CeremonyEffectDefinition) => `${definition.targetType}:${definition.triggerType}`;

/**
 * 이벤트 효과 정의 목록(플랫폼 관리자) — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-01/02. `frontend/list-screen-convention.md`의
 * 3단 구조(검색 → 목록 → 페이지네비게이션)를 그대로 따른다.
 *
 * **순서 이동은 이 페이지에 현재 로드된(필터·페이지네이션이 걸린) 배열이 아니라, 클릭
 * 시점에 그 (target, trigger) 그룹 전체를 새로 조회해 계산한다** — 서버의
 * `PUT .../order`가 `orderedIds`를 그룹의 id 전체 집합과 정확히 일치해야만 받아주기
 * 때문이다(일부만 보내면 `EFFECT_DEFINITION_ORDER_GROUP_MISMATCH`). keyword/enabled/
 * userVisible 필터가 걸려 있으면 그룹의 일부만 화면에 보여 사용자가 자신이 실제로 뭘
 * 재배열하는지 알기 어려우므로, 그 경우 이동 버튼 자체를 비활성화한다(targetType/
 * triggerType 필터는 그룹을 쪼개지 않으므로 허용한다).
 */
export const CeremonyEffectManagement: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_EFFECT_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [formValues, setFormValues] = useState<SearchParams>(EMPTY_SEARCH);
  const [searchParams, setSearchParams] = useState<SearchParams>(EMPTY_SEARCH);
  const [page, setPage] = useState(0);
  const [pageData, setPageData] = useState<PageResponse<CeremonyEffectDefinition> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reorderingKey, setReorderingKey] = useState('');
  const [previewEffect, setPreviewEffect] = useState<EffectPreviewDefinition | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchDefinitions(searchParams, page);
        if (!cancelled) setPageData(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '이벤트 효과 정의를 불러오지 못했습니다.';
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
  }, [searchParams, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setSearchParams({ ...formValues });
  };

  const handleReset = () => {
    setIsLoading(true);
    setFormValues(EMPTY_SEARCH);
    setPage(0);
    setSearchParams({ ...EMPTY_SEARCH });
  };

  const handlePageChange = (nextPage: number) => {
    setIsLoading(true);
    setPage(nextPage);
  };

  const canReorder = !searchParams.keyword.trim() && searchParams.enabled === 'ALL' && searchParams.userVisible === 'ALL';

  const handleMove = async (definition: CeremonyEffectDefinition, direction: -1 | 1) => {
    if (!canManage || !canReorder || reorderingKey) return;
    const key = groupKey(definition);
    setReorderingKey(key);
    try {
      const groupQuery = new URLSearchParams({
        targetType: definition.targetType, triggerType: definition.triggerType, size: '200',
      });
      const groupRes = await api.get(`/platform-admin/ceremony-effects?${groupQuery}`);
      const groupItems = (groupRes.data as PageResponse<CeremonyEffectDefinition>).content;
      const index = groupItems.findIndex((item) => item.id === definition.id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= groupItems.length) return;

      const reordered = [...groupItems];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

      await api.put('/platform-admin/ceremony-effects/order', {
        targetType: definition.targetType,
        triggerType: definition.triggerType,
        orderedIds: reordered.map((item) => item.id),
      });
      setPageData(await fetchDefinitions(searchParams, page));
    } catch (err) {
      const message = err instanceof Error ? err.message : '순서 변경에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setReorderingKey('');
    }
  };

  const definitions = pageData?.content ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">이벤트 효과 관리</h1>
          <p className="mt-1 text-sm text-gray-500">행사 등록/수정 화면과 행사 제어 화면에서 고를 수 있는 효과 프리셋 카탈로그입니다.</p>
        </div>
        {canManage && (
          <Link
            to="/admin/effects/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-950 text-white text-sm font-bold hover:bg-gray-800"
          >
            <Plus size={15} /> 효과 등록
          </Link>
        )}
      </div>

      <SearchBar onSubmit={handleSearch} onReset={handleReset}>
        <SearchField label="검색어" className="w-56">
          <input
            value={formValues.keyword}
            onChange={(e) => setFormValues({ ...formValues, keyword: e.target.value })}
            placeholder="코드 또는 표시 이름"
            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          />
        </SearchField>
        <SearchField label="대상 화면">
          <select
            value={formValues.targetType}
            onChange={(e) => setFormValues({ ...formValues, targetType: e.target.value as SearchParams['targetType'] })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            <option value="PROJECTOR">프로젝터 화면</option>
            <option value="SIGNER">서명자 화면</option>
          </select>
        </SearchField>
        <SearchField label="실행 시점">
          <select
            value={formValues.triggerType}
            onChange={(e) => setFormValues({ ...formValues, triggerType: e.target.value as SearchParams['triggerType'] })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            <option value="SIGNATURE_COMPLETED">개별 서명 완료</option>
            <option value="ALL_SIGNATURES_COMPLETED">전체 서명 완료</option>
            <option value="EVENT_FINISHED">행사 종료</option>
          </select>
        </SearchField>
        <SearchField label="활성">
          <select
            value={formValues.enabled}
            onChange={(e) => setFormValues({ ...formValues, enabled: e.target.value as SearchParams['enabled'] })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            <option value="true">사용 가능</option>
            <option value="false">사용 중지</option>
          </select>
        </SearchField>
        <SearchField label="사용자 노출">
          <select
            value={formValues.userVisible}
            onChange={(e) => setFormValues({ ...formValues, userVisible: e.target.value as SearchParams['userVisible'] })}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none"
          >
            <option value="ALL">전체</option>
            <option value="true">노출</option>
            <option value="false">비노출</option>
          </select>
        </SearchField>
      </SearchBar>

      <ListContainer
        isLoading={isLoading}
        isEmpty={definitions.length === 0}
        emptyMessage="해당 조건의 이벤트 효과 정의가 없습니다."
        pagination={
          pageData
            ? { page: pageData.page, totalPages: pageData.totalPages, hasNext: pageData.hasNext, totalElements: pageData.totalElements, onPageChange: handlePageChange }
            : undefined
        }
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">순서</th>
              <th className="text-left px-4 py-3 font-medium">코드</th>
              <th className="text-left px-4 py-3 font-medium">대상 / 실행 시점</th>
              <th className="text-left px-4 py-3 font-medium">표시 이름</th>
              <th className="text-left px-4 py-3 font-medium">활성</th>
              <th className="text-left px-4 py-3 font-medium">노출</th>
              <th className="text-left px-4 py-3 font-medium">수동 실행</th>
              <th className="text-left px-4 py-3 font-medium">등록일</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {definitions.map((definition) => {
              const isReorderingThisGroup = reorderingKey === groupKey(definition);
              return (
                <tr key={definition.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={!canManage || !canReorder || isReorderingThisGroup}
                        onClick={() => handleMove(definition, -1)}
                        title={canReorder ? '위로 이동' : '검색어/활성/노출 필터를 초기화해야 순서를 바꿀 수 있습니다.'}
                        className="p-1 rounded text-gray-400 hover:text-gray-950 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        {isReorderingThisGroup ? <Loader2 size={13} className="animate-spin" /> : <ArrowUp size={13} />}
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || !canReorder || isReorderingThisGroup}
                        onClick={() => handleMove(definition, 1)}
                        title={canReorder ? '아래로 이동' : '검색어/활성/노출 필터를 초기화해야 순서를 바꿀 수 있습니다.'}
                        className="p-1 rounded text-gray-400 hover:text-gray-950 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-700">{definition.code}</code>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {TARGET_LABEL[definition.targetType]}
                    <br />
                    <span className="text-xs text-gray-400">{TRIGGER_LABEL[definition.triggerType]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-950 font-medium">{definition.displayName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${definition.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {definition.enabled ? '사용 가능' : '사용 중지'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{definition.userVisible ? 'O' : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{definition.manuallyTriggerable ? 'O' : '-'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(definition.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewEffect({
                          code: definition.code,
                          displayName: definition.displayName,
                          targetType: definition.targetType,
                          triggerType: definition.triggerType,
                          rendererKey: definition.rendererKey,
                          configJson: definition.configJson ? JSON.stringify(definition.configJson) : null,
                        })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                      >
                        <Eye size={12} /> 미리보기
                      </button>
                      {canManage && (
                        <Link
                          to={`/admin/effects/${definition.id}/edit`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50"
                        >
                          수정
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ListContainer>

      <EffectPreviewDialog open={previewEffect != null} effect={previewEffect} onClose={() => setPreviewEffect(null)} />
    </div>
  );
};
