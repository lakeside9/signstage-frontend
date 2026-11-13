import { useState } from 'react';
import type { ChangeEvent, FC, FormEvent } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { useSnackbarStore } from '../../store/useSnackbarStore';
import { api } from '../../utils/api';
import { Field, FormActions } from '../billingCatalog/components';
import { inputClass } from '../billingCatalog/constants';
import { useQuoteSealUrl } from './useQuoteSealUrl';
import type { QuoteSupplier, QuoteTemplate, SaveQuoteSupplierRequest } from '../../types';

const ENDPOINT = '/platform-admin/quote-templates';
const SEAL_MAX_BYTES = 2 * 1024 * 1024;

interface SupplierDraft {
  name: string;
  representative: string;
  businessNumber: string;
  address: string;
  phone: string;
}

const toDraft = (supplier: QuoteSupplier): SupplierDraft => ({
  name: supplier.name ?? '',
  representative: supplier.representative ?? '',
  businessNumber: supplier.businessNumber ?? '',
  address: supplier.address ?? '',
  phone: supplier.phone ?? '',
});

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

const hasSupplier = (supplier: QuoteSupplier) =>
  [supplier.name, supplier.representative, supplier.businessNumber, supplier.address, supplier.phone].some((value) => value !== null);

/**
 * 견적 공통 문구의 공급자 정보·인감(2026-11-13). 견적서 오른쪽 위 공급자 칸에 보이고, 인감은 대표자 이름 옆에 찍힌다.
 * 견적에 쓰인 문구는 비어 있을 때 한 번만 채울 수 있다 — 바꾸려면 기간을 종료하고 새 문구를 등록한다.
 * 인감 파일은 서버 저장소에 두고 관리자 인증으로만 내려받는다.
 */
export const QuoteSupplierModal: FC<{
  template: QuoteTemplate | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}> = ({ template, onClose, onChanged }) => (
  <Modal open={template !== null} onClose={onClose} title="견적서 공급자·인감" widthClassName="max-w-xl">
    {template && <QuoteSupplierForm key={template.id} template={template} onClose={onClose} onChanged={onChanged} />}
  </Modal>
);

const QuoteSupplierForm: FC<{
  template: QuoteTemplate;
  onClose: () => void;
  onChanged: () => Promise<void>;
}> = ({ template, onClose, onChanged }) => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const supplier = template.supplier;
  const [draft, setDraft] = useState<SupplierDraft>(() => toDraft(supplier));
  const [isSaving, setIsSaving] = useState(false);
  const [isSealBusy, setIsSealBusy] = useState(false);
  const [sealVersion, setSealVersion] = useState(0);
  const { sealUrl, isLoaded: isSealLoaded } = useQuoteSealUrl(
    supplier.sealAvailable ? `${ENDPOINT}/${template.id}/seal` : null,
    sealVersion,
  );

  const canEditSupplier = !template.used || !hasSupplier(supplier);
  const canUploadSeal = !template.used || !supplier.sealAvailable;
  const canDeleteSeal = !template.used && supplier.sealAvailable;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const request: SaveQuoteSupplierRequest = {
      name: blankToNull(draft.name),
      representative: blankToNull(draft.representative),
      businessNumber: blankToNull(draft.businessNumber),
      address: blankToNull(draft.address),
      phone: blankToNull(draft.phone),
    };
    setIsSaving(true);
    try {
      await api.put(`${ENDPOINT}/${template.id}/supplier`, request);
      showSnackbar('공급자 정보를 저장했습니다.', 'success');
      await onChanged();
      onClose();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '공급자 정보 저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSealSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > SEAL_MAX_BYTES) {
      showSnackbar('인감은 2MB 이하의 PNG 또는 JPEG 이미지만 올릴 수 있습니다.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setIsSealBusy(true);
    try {
      await api.post(`${ENDPOINT}/${template.id}/seal`, formData);
      showSnackbar('인감을 올렸습니다.', 'success');
      await onChanged();
      setSealVersion((prev) => prev + 1);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '인감 업로드에 실패했습니다.', 'error');
    } finally {
      setIsSealBusy(false);
    }
  };

  const handleSealDelete = async () => {
    setIsSealBusy(true);
    try {
      await api.delete(`${ENDPOINT}/${template.id}/seal`);
      showSnackbar('인감을 삭제했습니다.', 'success');
      await onChanged();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '인감 삭제에 실패했습니다.', 'error');
    } finally {
      setIsSealBusy(false);
    }
  };

  const field = (key: keyof SupplierDraft, label: string, maxLength: number, placeholder: string) => (
    <Field label={label}>
      <input
        value={draft[key]}
        onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
        disabled={isSaving || !canEditSupplier}
        maxLength={maxLength}
        placeholder={placeholder}
        className={inputClass}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {field('name', '상호', 100, '예) 주식회사 이폼웍스')}
          {field('representative', '대표자', 50, '예) 홍길동')}
          {field('businessNumber', '사업자등록번호', 20, '예) 123-45-67890')}
          {field('phone', '연락처', 50, '예) 02-1234-5678')}
        </div>
        {field('address', '주소', 300, '예) 서울특별시 ...')}
        {canEditSupplier ? (
          <>
            <p className="text-xs text-gray-400">
              비운 칸은 견적서에 나오지 않습니다.
              {template.used && ' 견적에 쓰인 문구라 지금 한 번만 채울 수 있습니다 — 저장한 뒤에는 바꿀 수 없습니다.'}
            </p>
            <FormActions isSaving={isSaving} savingLabel="저장 중..." saveLabel="저장" onCancel={onClose} />
          </>
        ) : (
          <p className="text-xs text-gray-400">
            견적에 쓰인 문구라 공급자 정보를 바꿀 수 없습니다. 바꾸려면 기간을 종료하고 새 문구를 등록해주세요.
          </p>
        )}
      </form>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-500 mb-2">인감</p>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50">
            {!isSealLoaded ? (
              <Loader2 size={16} className="animate-spin text-gray-400" />
            ) : sealUrl ? (
              <img src={sealUrl} alt="인감" className="max-h-20 max-w-20 object-contain" />
            ) : (
              <span className="text-xs text-gray-400">없음</span>
            )}
          </div>
          <div className="space-y-2">
            {canUploadSeal && (
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                <Upload size={12} /> {supplier.sealAvailable ? '인감 바꾸기' : '인감 올리기'}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleSealSelected}
                  disabled={isSealBusy}
                  className="hidden"
                />
              </label>
            )}
            {canDeleteSeal && (
              <button
                type="button"
                onClick={handleSealDelete}
                disabled={isSealBusy}
                className="px-2 py-1 text-xs font-medium rounded-md ml-2 inline-flex items-center gap-1 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} /> 인감 삭제
              </button>
            )}
            <p className="text-xs text-gray-400">
              배경이 투명한 PNG를 권장합니다(2MB 이하). 견적서의 대표자 이름 옆에 찍힙니다.
              {template.used && supplier.sealAvailable && ' 견적에 쓰인 문구라 인감을 바꾸거나 지울 수 없습니다.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
