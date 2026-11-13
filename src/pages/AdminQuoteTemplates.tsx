import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { CalendarX, Pencil, Plus, ScrollText, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ListContainer } from '../components/ListContainer';
import { Modal } from '../components/Modal';
import { usePermissionStore } from '../store/usePermissionStore';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import { useClientPagination } from '../utils/useClientPagination';
import { Field, FormActions } from './billingCatalog/components';
import { inputClass, normalizeDescription, todayIsoDate } from './billingCatalog/constants';
import { formatPeriod, isPeriodOpen } from './order/constants';
import type { QuoteTemplate, SaveQuoteTemplateRequest } from '../types';

const ENDPOINT = '/platform-admin/quote-templates';

interface TemplateDraft {
  serviceDescription: string;
  footerNotice: string;
  effectiveFrom: string;
  effectiveTo: string;
}

const emptyDraft = (): TemplateDraft => ({ serviceDescription: '', footerNotice: '', effectiveFrom: todayIsoDate(), effectiveTo: '' });

/** 오늘이 기간 안에 있는 문구 — 지금 새 견적에 복사되는 문구다. */
const isEffectiveToday = (template: QuoteTemplate) => {
  const today = todayIsoDate();
  return template.effectiveFrom <= today && (template.effectiveTo === null || template.effectiveTo >= today);
};

/**
 * 견적 공통 문구(플랫폼 관리자) — 견적서 "제공 서비스" 본문과 하단 안내문구를 기간별로 둔다(2026-11-13, 플랜의
 * 서비스 설명을 옮겼다). 수주 가격표와 같은 규칙이다: 기간은 겹칠 수 없고, 새 견적은 저장일에 유효한 문구를 복사한다.
 * 견적에 쓰인 문구는 고치거나 지울 수 없어 기간을 닫고 새 문구를 등록한다 — 이미 만든 견적은 복사본이라 바뀌지 않는다.
 */
export const AdminQuoteTemplates: FC = () => {
  const canManage = usePermissionStore((state) => state.hasPermission('ACTION_ORDER_PRICE_MANAGE'));
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pageItems, pagination } = useClientPagination(templates);

  const [isFormOpen, setIsFormOpen] = useState(false);
  /** 수정 중인 문구 id — null이면 새로 등록한다. */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closeDate, setCloseDate] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reload = async () => {
    const response = await api.get(ENDPOINT);
    setTemplates(response.data as QuoteTemplate[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(ENDPOINT);
        if (!cancelled) setTemplates(response.data as QuoteTemplate[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : '견적 공통 문구를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSnackbar]);

  const openCreate = () => {
    // 새 문구는 지금 쓰는 문구에서 시작한다 — 보통 일부만 고쳐 다음 기간 문구를 만든다.
    const current = templates.find(isEffectiveToday);
    setDraft({
      ...emptyDraft(),
      serviceDescription: current?.serviceDescription ?? '',
      footerNotice: current?.footerNotice ?? '',
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  const openEdit = (template: QuoteTemplate) => {
    setDraft({
      serviceDescription: template.serviceDescription ?? '',
      footerNotice: template.footerNotice ?? '',
      effectiveFrom: template.effectiveFrom,
      effectiveTo: template.effectiveTo ?? '',
    });
    setEditingId(template.id);
    setIsFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.effectiveFrom) {
      showSnackbar('시작일을 입력해주세요.', 'error');
      return;
    }
    const request: SaveQuoteTemplateRequest = {
      serviceDescription: normalizeDescription(draft.serviceDescription),
      footerNotice: normalizeDescription(draft.footerNotice),
      effectiveFrom: draft.effectiveFrom,
      effectiveTo: draft.effectiveTo || null,
    };
    setIsSaving(true);
    try {
      if (editingId !== null) {
        await api.put(`${ENDPOINT}/${editingId}`, request);
      } else {
        await api.post(ENDPOINT, request);
      }
      showSnackbar(editingId !== null ? '문구를 수정했습니다.' : '문구를 등록했습니다.', 'success');
      setIsFormOpen(false);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : editingId !== null ? '수정에 실패했습니다.' : '등록에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openClose = (id: number) => {
    setCloseDate(todayIsoDate());
    setClosingId(id);
  };

  const handleClose = async (e: FormEvent) => {
    e.preventDefault();
    if (closingId === null || !closeDate) return;
    setIsSaving(true);
    try {
      await api.put(`${ENDPOINT}/${closingId}/close`, { effectiveTo: closeDate });
      showSnackbar('기간을 닫았습니다.', 'success');
      setClosingId(null);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '기간 종료에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    setIsDeleting(true);
    try {
      await api.delete(`${ENDPOINT}/${deletingId}`);
      showSnackbar('문구를 삭제했습니다.', 'success');
      setDeletingId(null);
      await reload();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const actionButtonClass = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-500 hover:text-gray-950 hover:bg-gray-50';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
            <ScrollText size={20} className="text-gray-400" />
            견적 공통 문구
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            견적서의 "제공 서비스" 설명과 하단 안내문구입니다. 새 견적은 저장일에 유효한 문구를 복사하고, 견적마다 고칠 수 있습니다.
            견적에 쓰인 문구는 고칠 수 없어 기간을 종료하고 새 문구를 등록합니다.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus size={16} /> 문구 등록
          </Button>
        )}
      </div>

      <ListContainer
        isLoading={isLoading}
        isEmpty={templates.length === 0}
        emptyMessage="등록된 견적 공통 문구가 없습니다. 새 견적의 서비스 설명과 하단 안내문구가 비어 있게 됩니다."
        pagination={isLoading ? undefined : pagination}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3 font-medium">견적서 서비스 설명</th>
              <th className="text-left px-4 py-3 font-medium">하단 안내문구</th>
              <th className="text-left px-4 py-3 font-medium whitespace-nowrap">적용 기간</th>
              <th className="text-right px-4 py-3 font-medium">처리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.map((template) => (
              <tr key={template.id} className="align-top">
                <td className="px-4 py-3 text-gray-950 whitespace-pre-line">
                  {template.serviceDescription ?? <span className="text-gray-400">없음</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-pre-line">
                  {template.footerNotice ?? <span className="text-gray-400">없음</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatPeriod(template.effectiveFrom, template.effectiveTo)}
                  {isEffectiveToday(template) && (
                    <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">현재 적용</span>
                  )}
                  {template.used && <span className="block mt-0.5 text-xs text-gray-400">견적에 사용됨</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <div className="inline-flex items-center gap-1">
                      {!template.used && (
                        <button type="button" onClick={() => openEdit(template)} className={actionButtonClass}>
                          <Pencil size={12} /> 수정
                        </button>
                      )}
                      {isPeriodOpen(template.effectiveTo) && (
                        <button type="button" onClick={() => openClose(template.id)} className={actionButtonClass}>
                          <CalendarX size={12} /> 기간 종료
                        </button>
                      )}
                      {!template.used && (
                        <button
                          type="button"
                          onClick={() => setDeletingId(template.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={12} /> 삭제
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListContainer>

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={`견적 공통 문구 ${editingId !== null ? '수정' : '등록'}`}
        widthClassName="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="견적서 서비스 설명">
            <textarea
              value={draft.serviceDescription}
              onChange={(e) => setDraft((prev) => ({ ...prev, serviceDescription: e.target.value }))}
              disabled={isSaving}
              rows={6}
              maxLength={5000}
              placeholder={'고객 견적서의 "제공 서비스"에 보이는 설명입니다. 예)\n- 협약식 전자서명 서비스 제공\n- 협약식 리허설 지원'}
              className={`${inputClass} resize-y`}
            />
          </Field>
          <Field label="견적서 하단 안내문구">
            <textarea
              value={draft.footerNotice}
              onChange={(e) => setDraft((prev) => ({ ...prev, footerNotice: e.target.value }))}
              disabled={isSaving}
              rows={7}
              maxLength={2000}
              placeholder="견적서 맨 아래에 보이는 안내입니다. 예) 본 견적은 유효기간까지 유효하며, 행사 범위가 바뀌면 다시 견적합니다."
              className={`${inputClass} resize-y`}
            />
          </Field>
          <p className="text-xs text-gray-400">
            줄바꿈은 그대로 보입니다("- "로 시작하면 목록처럼 읽힙니다). 비운 칸은 견적서에 나오지 않습니다.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <input
                type="date"
                value={draft.effectiveFrom}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
            <Field label="종료일(비우면 종료일 없음)">
              <input
                type="date"
                value={draft.effectiveTo}
                onChange={(e) => setDraft((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                disabled={isSaving}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400">
            다른 문구와 기간이 겹칠 수 없습니다 — 지금 문구를 바꾸려면 기존 문구의 기간을 먼저 종료하세요.
            {editingId !== null && ' 아직 견적에 쓰이지 않은 문구라 바로 고칩니다.'}
          </p>
          <FormActions
            isSaving={isSaving}
            savingLabel={editingId !== null ? '저장 중...' : '등록 중...'}
            saveLabel={editingId !== null ? '저장' : '등록'}
            onCancel={() => setIsFormOpen(false)}
          />
        </form>
      </Modal>

      <Modal open={closingId !== null} onClose={() => setClosingId(null)} title="기간 종료" widthClassName="max-w-sm">
        <form onSubmit={handleClose} className="space-y-3">
          <Field label="종료일">
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              disabled={isSaving}
              className={inputClass}
            />
          </Field>
          <p className="text-xs text-gray-400">종료일까지 이 문구를 쓰고, 다음 날부터는 새 기간 문구를 씁니다.</p>
          <FormActions isSaving={isSaving} savingLabel="처리 중..." saveLabel="기간 종료" onCancel={() => setClosingId(null)} />
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        title="문구 삭제"
        message="이 문구를 삭제할까요? 견적에 쓰이지 않은 문구만 지울 수 있고, 삭제하면 되돌릴 수 없습니다."
        isSubmitting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
