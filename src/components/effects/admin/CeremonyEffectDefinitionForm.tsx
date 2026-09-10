import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Eye, Loader2, Save } from 'lucide-react';
import { Button } from '../../Button';
import { EffectPreviewDialog } from '../preview/EffectPreviewDialog';
import type { EffectPreviewDefinition } from '../preview/EffectPreviewStage';
import type { CeremonyEffectTarget, CeremonyEffectTrigger } from '../../../types';

export interface CeremonyEffectFormValue {
  code: string;
  targetType: CeremonyEffectTarget;
  triggerType: CeremonyEffectTrigger;
  displayName: string;
  description: string;
  rendererKey: string;
  enabled: boolean;
  userVisible: boolean;
  manuallyTriggerable: boolean;
  /** 설정 JSON 원문 — 제출 직전에만 파싱한다(EffectPreviewStage와 같은 이유로 원문을 들고 있는다). */
  configJsonDraft: string;
}

const EMPTY_VALUE: CeremonyEffectFormValue = {
  code: '',
  targetType: 'PROJECTOR',
  triggerType: 'SIGNATURE_COMPLETED',
  displayName: '',
  description: '',
  rendererKey: '',
  enabled: true,
  userVisible: true,
  manuallyTriggerable: false,
  configJsonDraft: '',
};

interface Props {
  mode: 'create' | 'edit';
  initialValue?: CeremonyEffectFormValue;
  saving: boolean;
  onSubmit: (value: CeremonyEffectFormValue) => Promise<void>;
  onCancel: () => void;
}

const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-950/10 disabled:bg-gray-50 disabled:text-gray-500';

/**
 * 이벤트 효과 정의 등록/수정 공용 폼 — signstage-docs
 * business/ceremony-event-effect-implementation-tasks.md FE-ADMIN-02.
 *
 * 이 효과를 여는 단위 상품(묶음) 구성은 이 폼이 갖지 않는다(2026-09-08 재설계) — 예전에는
 * `requiredOptionalFeatureId` 단일 FK를 등록 시점에 여기서 골랐지만, 이제는 "이벤트 효과
 * 묶음"이 여러 효과를 자유롭게 겹쳐 담는 N:M 구조라 반대쪽(단위 상품 등록/수정 화면,
 * `AdminUnitProductCreate.tsx`/`AdminUnitProductEdit.tsx` — 2026-09-10 `UnitProduct` 통합
 * 이전엔 `AdminOptionalFeatureCreate.tsx`/`AdminOptionalFeatureEdit.tsx`였다)에서 묶음이
 * 담을 효과 목록을 고르는 방식으로 바뀌었다.
 *
 * code/대상/실행시점/Renderer 키는 `mode === 'edit'`이면 비활성 입력으로 그대로 보여주기만
 * 한다(값을 지우지 않는다) — 서버도 `UpdateCeremonyEffectDefinition` 요청 자체에 이 필드들을
 * 받지 않으므로, 화면에서 바꿔도 전송되지 않아 안전하지만, 애초에 "바꿀 수 있어 보이는"
 * 입력을 안 만드는 편이 낫다.
 */
export const CeremonyEffectDefinitionForm: FC<Props> = ({ mode, initialValue, saving, onSubmit, onCancel }) => {
  const [value, setValue] = useState<CeremonyEffectFormValue>(initialValue ?? EMPTY_VALUE);
  const [error, setError] = useState('');
  const [previewEffect, setPreviewEffect] = useState<EffectPreviewDefinition | null>(null);

  const update = (patch: Partial<CeremonyEffectFormValue>) => setValue((current) => ({ ...current, ...patch }));
  const immutable = mode === 'edit';

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!value.code.trim() || !/^[A-Z][A-Z0-9_]*$/.test(value.code.trim())) {
      setError('효과 코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있고 대문자로 시작해야 합니다.');
      return;
    }
    if (!value.displayName.trim()) {
      setError('표시 이름을 입력해주세요.');
      return;
    }
    if (!value.rendererKey.trim()) {
      setError('Renderer 키를 입력해주세요.');
      return;
    }
    if (value.configJsonDraft.trim()) {
      try {
        const parsed = JSON.parse(value.configJsonDraft);
        if (parsed == null || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      } catch {
        setError('설정 JSON은 올바른 객체 형식이어야 합니다.');
        return;
      }
    }

    setError('');
    await onSubmit({
      ...value,
      code: value.code.trim(),
      displayName: value.displayName.trim(),
      rendererKey: value.rendererKey.trim(),
      description: value.description.trim(),
      configJsonDraft: value.configJsonDraft.trim(),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-bold text-gray-700">효과 코드 *</span>
          <input
            disabled={immutable}
            maxLength={50}
            value={value.code}
            onChange={(e) => update({ code: e.target.value.toUpperCase() })}
            placeholder="예: SPARKLE"
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-bold text-gray-700">Renderer 키 *</span>
          <input
            disabled={immutable}
            maxLength={100}
            value={value.rendererKey}
            onChange={(e) => update({ rendererKey: e.target.value })}
            placeholder="예: projector-sparkle"
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-bold text-gray-700">대상 화면 *</span>
          <select
            disabled={immutable}
            value={value.targetType}
            onChange={(e) => update({ targetType: e.target.value as CeremonyEffectTarget })}
            className={inputClass}
          >
            <option value="PROJECTOR">프로젝터 화면</option>
            <option value="SIGNER">서명자 화면</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-bold text-gray-700">실행 시점 *</span>
          <select
            disabled={immutable}
            value={value.triggerType}
            onChange={(e) => update({ triggerType: e.target.value as CeremonyEffectTrigger })}
            className={inputClass}
          >
            <option value="SIGNATURE_COMPLETED">개별 서명 완료</option>
            <option value="ALL_SIGNATURES_COMPLETED">전체 서명 완료</option>
            <option value="EVENT_FINISHED">행사 종료</option>
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-bold text-gray-700">표시 이름 *</span>
          <input maxLength={100} value={value.displayName} onChange={(e) => update({ displayName: e.target.value })} className={inputClass} />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-bold text-gray-700">설명</span>
          <textarea
            rows={3}
            maxLength={500}
            value={value.description}
            onChange={(e) => update({ description: e.target.value })}
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="space-y-3 md:col-span-2">
          {mode === 'edit' && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={value.enabled} onChange={(e) => update({ enabled: e.target.checked })} className="h-4 w-4 rounded" />
              사용 가능
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={value.userVisible} onChange={(e) => update({ userVisible: e.target.checked })} className="h-4 w-4 rounded" />
            사용자 선택 화면에 노출
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value.manuallyTriggerable}
              onChange={(e) => update({ manuallyTriggerable: e.target.checked })}
              className="h-4 w-4 rounded"
            />
            관리자 수동 실행 허용
          </label>
          <p className="text-[11px] leading-5 text-gray-500">
            노출을 끄면 행사 등록/수정 화면의 효과 선택 목록에서 숨겨집니다. 이미 선택된 행사의 실행에는 영향을 주지 않습니다.
          </p>
        </div>

        <label className="space-y-2 md:col-span-2">
          <span className="text-xs font-bold text-gray-700">설정 JSON</span>
          <textarea
            rows={6}
            maxLength={10000}
            spellCheck={false}
            value={value.configJsonDraft}
            onChange={(e) => update({ configJsonDraft: e.target.value })}
            placeholder='예: {"durationMs":1600}'
            className={`${inputClass} bg-gray-50 font-mono text-xs`}
          />
          <p className="text-[11px] text-gray-500">빈 값으로 저장하면 설정을 제거합니다.</p>
        </label>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
        <button
          type="button"
          disabled={saving}
          onClick={() => setPreviewEffect({
            code: value.code || '(코드 없음)',
            displayName: value.displayName || '(표시 이름 없음)',
            targetType: value.targetType,
            triggerType: value.triggerType,
            rendererKey: value.rendererKey,
            configJson: value.configJsonDraft,
          })}
          className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
        >
          <Eye size={15} /> 미리보기
        </button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} 저장
        </Button>
      </div>

      <EffectPreviewDialog open={previewEffect != null} effect={previewEffect} onClose={() => setPreviewEffect(null)} />
    </form>
  );
};
