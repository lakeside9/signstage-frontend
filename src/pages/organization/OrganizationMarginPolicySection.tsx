import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { FormattedNumberInput } from '../../components/FormattedNumberInput';
import { usePermissionStore } from '../../store/usePermissionStore';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { formatCurrency } from '../../utils/internationalization';
import type { MarginType, OrganizationMarginPeriod } from '../../types';

const STATUS_LABEL = { ACTIVE: '적용 중', SCHEDULED: '예정', EXPIRED: '종료' };
const MAX_MARGIN_DATE = '9999-12-31';
const MIN_MARGIN_DATE = '1000-01-01';
const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-md text-sm';

export const OrganizationMarginPolicySection: FC<{ organizationId: string }> = ({ organizationId }) => {
  return <MarginPeriodList key={organizationId} organizationId={organizationId} />;
};

const MarginPeriodList: FC<{ organizationId: string }> = ({ organizationId }) => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_MARGIN_POLICY_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [policies, setPolicies] = useState<OrganizationMarginPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState<{ id: number | null } | null>(null);
  const [marginType, setMarginType] = useState<MarginType>('PERCENT');
  const [marginValue, setMarginValue] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const basePath = `/organizations/${organizationId}/margin-policy/periods`;

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    api.get(basePath).then((response) => {
      if (!cancelled) setPolicies(response.data as OrganizationMarginPeriod[]);
    }).catch((err: unknown) => {
      if (!cancelled) {
        setLoadFailed(true);
        showSnackbar(err instanceof Error ? err.message : '마진 목록을 불러오지 못했습니다.', 'error');
      }
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [basePath, canManage, reload, showSnackbar]);

  const openForm = (policy?: OrganizationMarginPeriod) => {
    setEditing({ id: policy?.id ?? null });
    setMarginType(policy?.marginType ?? 'PERCENT');
    setMarginValue(policy ? String(policy.marginValue) : '');
    setEffectiveFrom(policy?.effectiveFrom ?? '');
    setEffectiveTo(policy?.effectiveTo ?? '');
  };

  const latestEnd = policies.reduce<string | null>((latest, policy) => {
    const end = policy.effectiveTo ?? MAX_MARGIN_DATE;
    return latest === null || end > latest ? end : latest;
  }, null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || isSaving) return;
    const value = Number(marginValue);
    const resolvedTo = effectiveTo || MAX_MARGIN_DATE;
    if (!marginValue.trim() || !Number.isFinite(value) || value < 0 || !effectiveFrom
      || effectiveFrom < MIN_MARGIN_DATE || effectiveFrom > MAX_MARGIN_DATE
      || resolvedTo > MAX_MARGIN_DATE || effectiveFrom > resolvedTo) {
      showSnackbar('유효한 기간과 0 이상의 마진을 입력해주세요.', 'error');
      return;
    }
    if (policies.some((policy) => policy.id !== editing.id && policy.effectiveFrom <= resolvedTo
      && (policy.effectiveTo === null || policy.effectiveTo >= effectiveFrom))) {
      showSnackbar('기존 마진 정책과 기간이 겹칩니다. 기존 정책의 종료일을 먼저 조정해주세요.', 'error');
      return;
    }
    if (editing.id === null && latestEnd !== null && effectiveFrom <= latestEnd) {
      showSnackbar(`새 시작일은 기존 정책의 가장 늦은 종료일(${latestEnd})보다 뒤여야 합니다.`, 'error');
      return;
    }
    setIsSaving(true);
    try {
      const body = { marginType, marginValue: value, effectiveFrom, effectiveTo: effectiveTo || null };
      if (editing.id === null) await api.post(basePath, body);
      else await api.put(`${basePath}/${editing.id}`, body);
      setEditing(null);
      setIsLoading(true);
      setLoadFailed(false);
      setReload((value) => value + 1);
      showSnackbar('마진 정책을 저장했습니다. 기존 견적은 변경되지 않습니다.', 'success');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '마진 저장에 실패했습니다.', 'error');
    } finally { setIsSaving(false); }
  };

  if (!canManage) return null;
  return (
    <section className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-950">재판매 마진</h2>
        {!editing && <button type="button" disabled={isLoading || loadFailed} onClick={() => openForm()}
          className="px-3 py-1.5 border rounded-md text-xs disabled:opacity-40">기간 추가</button>}
      </div>
      <p className="text-xs text-gray-500 mb-3">
        우리 파트너사의 시스템 사용료 재판매 마진입니다. 견적 저장일의 정책을 적용하며 시작일·종료일을 모두 포함합니다.
        행사별 마진이 있으면 우선 적용합니다. 0%도 설정할 수 있습니다. 저장된 견적은 정책 수정 후에도 유지됩니다.
      </p>
      {policies[0] && <p className="text-xs text-gray-500 mb-3">적용 기준 시간대: {policies[0].timeZoneId}</p>}
      <div className="mb-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
        <p>기간 추가: 새 시작일은 기존 정책의 가장 늦은 종료일보다 뒤여야 합니다. 과거 기간이나 중간 공백에 추가할 수 없습니다.</p>
        <p>종료일 당일까지 포함하므로 종료일과 새 시작일이 같아도 등록할 수 없습니다. 수정 시에도 다른 정책과 기간이 겹칠 수 없습니다.</p>
        {latestEnd && <p>현재 가장 늦은 종료일: {latestEnd}</p>}
        {latestEnd === MAX_MARGIN_DATE && <p>새 기간을 추가하려면 기존 정책의 종료일(9999-12-31)을 먼저 수정해주세요.</p>}
      </div>
      {editing && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-md space-y-3">
          <h3 className="text-sm font-medium">{editing.id === null ? '기간 추가' : '기간 수정'}</h3>
          <fieldset disabled={isSaving} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs space-y-1">시작일<input aria-label="시작일" type="date" required min={MIN_MARGIN_DATE} max={MAX_MARGIN_DATE} value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)} className={inputClass} /></label>
            <label className="text-xs space-y-1">종료일 (선택)<input aria-label="종료일" type="date" min={effectiveFrom || MIN_MARGIN_DATE} max={MAX_MARGIN_DATE} value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)} className={inputClass} /></label>
            <label className="text-xs space-y-1">마진 유형<select aria-label="마진 유형" value={marginType}
              onChange={(e) => setMarginType(e.target.value as MarginType)} className={inputClass}>
              <option value="PERCENT">정률(%)</option><option value="FIXED_AMOUNT">정액</option>
            </select></label>
            <label className="text-xs space-y-1">마진 값<FormattedNumberInput min={0} step="0.0001"
              value={marginValue} onChange={setMarginValue} className={inputClass} /></label>
          </fieldset>
          <p className="text-xs text-gray-500">종료일을 비워두면 9999-12-31로 저장합니다.</p>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={isSaving} onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs">취소</button>
            <button type="submit" disabled={isSaving} className="px-3 py-1.5 rounded-md bg-gray-950 text-white text-xs disabled:opacity-40">
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}
      {isLoading ? <p className="text-sm text-gray-500">불러오는 중...</p> : loadFailed ? (
        <button type="button" onClick={() => {
          setIsLoading(true);
          setLoadFailed(false);
          setReload((value) => value + 1);
        }} className="text-sm underline">목록 다시 불러오기</button>
      ) : policies.length === 0 ? <p className="text-sm text-gray-500">등록된 마진 정책이 없습니다.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-gray-500 border-b"><tr>
              <th className="py-2 pr-3">시작일</th><th className="pr-3">종료일</th><th className="pr-3">유형</th>
              <th className="pr-3">마진</th><th className="pr-3">상태</th><th>관리</th>
            </tr></thead>
            <tbody>{policies.map((policy) => <tr key={policy.id} className="border-b border-gray-100">
              <td className="py-3 pr-3">{policy.effectiveFrom}</td><td className="pr-3">{policy.effectiveTo ?? '종료일 없음 (기존 정책)'}</td>
              <td className="pr-3">{policy.marginType === 'PERCENT' ? '정률' : '정액'}</td>
              <td className="pr-3">{policy.marginType === 'PERCENT' ? `${policy.marginValue}%` : formatCurrency(policy.marginValue, policy.currencyCode)}</td>
              <td className="pr-3">{STATUS_LABEL[policy.status]}</td>
              <td><button type="button" disabled={isSaving} onClick={() => openForm(policy)} className="text-xs underline">수정</button></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
};
