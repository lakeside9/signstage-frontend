import { create } from 'zustand';
import { temporal } from 'zundo';

/**
 * 서명란 배치 화면(캔버스) 전용 편집 상태. legacy(~/Works/eform/source/signstage/
 * signstage-frontend/src/store/useTemplateStore.ts)를 그대로 이식했다 — `zundo`로 실행취소/
 * 다시실행을 얹은 것만 빼면 평범한 zustand 스토어다. "저장" 버튼을 눌러야
 * `PUT .../templates/{id}/fields`로 서버에 반영되고, 그 전까지는 여기 상태에서만 논다.
 *
 * `tempId`는 프론트에서만 쓰는 안정적인 키다 — 서버 `id`는 저장할 때마다 바뀔 수 있어서
 * (일괄 저장이 항상 전체 교체라 새 id가 발급된다, TemplateFieldService#setFields 참고)
 * 캔버스 선택/드래그 상태를 이 id에 의존하면 저장 직후 선택이 끊긴다.
 */
export interface EditableTemplateField {
  tempId: string;
  id?: number;
  fieldKey?: string;
  signerId?: number | null;
  pageIndex: number;
  fieldIndex: number;
  fieldName: string;
  roleCode?: string | null;
  signOrder?: number | null;
  isRequired?: boolean;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

interface TemplateFieldEditorState {
  fields: EditableTemplateField[];
  selectedTempIds: string[];

  setFields: (fields: EditableTemplateField[]) => void;
  setSelectedTempIds: (ids: string[]) => void;
  addField: (field: EditableTemplateField) => void;
  removeField: (tempId: string) => void;
  updateField: (tempId: string, updates: Partial<EditableTemplateField>) => void;
  updateFields: (updates: Array<{ tempId: string; updates: Partial<EditableTemplateField> }>) => void;
  reset: () => void;
}

export const useTemplateFieldStore = create<TemplateFieldEditorState>()(
  temporal((set) => ({
    fields: [],
    selectedTempIds: [],

    setFields: (fields) => set({ fields }),

    setSelectedTempIds: (selectedTempIds) => set({ selectedTempIds }),

    addField: (field) =>
      set((state) => ({
        fields: [...state.fields, field],
        selectedTempIds: [field.tempId],
      })),

    removeField: (tempId) =>
      set((state) => ({
        fields: state.fields.filter((f) => f.tempId !== tempId),
        selectedTempIds: state.selectedTempIds.filter((id) => id !== tempId),
      })),

    updateField: (tempId, updates) =>
      set((state) => ({
        fields: state.fields.map((f) => (f.tempId === tempId ? { ...f, ...updates } : f)),
      })),

    updateFields: (batchUpdates) =>
      set((state) => {
        const newFields = [...state.fields];
        batchUpdates.forEach(({ tempId, updates }) => {
          const idx = newFields.findIndex((f) => f.tempId === tempId);
          if (idx !== -1) {
            newFields[idx] = { ...newFields[idx], ...updates };
          }
        });
        return { fields: newFields };
      }),

    reset: () => set({ fields: [], selectedTempIds: [] }),
  })),
);
