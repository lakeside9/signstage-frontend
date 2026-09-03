import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import type Konva from 'konva';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  Undo2,
  Redo2,
  Lock,
  UserPlus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { useTemplateFieldStore } from '../store/useTemplateFieldStore';
import type { EditableTemplateField } from '../store/useTemplateFieldStore';
import { api } from '../utils/api';
import type {
  CeremonySummary,
  CreateTemplateFieldRequest,
  SignerSummary,
  TemplateDocumentRole,
  TemplateFieldSummary,
  TemplateInfo,
  TemplateSummary,
} from '../types';

const FIELD_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#1d4ed8' },
  { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#b91c1c' },
  { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#047857' },
  { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#b45309' },
  { bg: 'rgba(139, 92, 246, 0.15)', border: '#8b5cf6', text: '#6d28d9' },
  { bg: 'rgba(236, 72, 153, 0.15)', border: '#ec4899', text: '#be185d' },
  { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#0e7490' },
  { bg: 'rgba(132, 204, 22, 0.15)', border: '#84cc16', text: '#4d7c0f' },
];

const DOCUMENT_ROLE_LABEL: Record<TemplateDocumentRole, string> = { CONTRACT: '계약서', EXHIBITION: '전시문서' };

const BASE_WIDTH = 800;

const DEFAULT_FIELD_POSITION = { xRatio: 0.425, yRatio: 0.475, widthRatio: 0.15, heightRatio: 0.05 };

type PlacementRect = { xRatio: number; yRatio: number; widthRatio: number; heightRatio: number };

const rectsOverlap = (a: PlacementRect, b: PlacementRect) =>
  a.xRatio < b.xRatio + b.widthRatio &&
  a.xRatio + a.widthRatio > b.xRatio &&
  a.yRatio < b.yRatio + b.heightRatio &&
  a.yRatio + a.heightRatio > b.yRatio;

/**
 * 서명란(TemplateField) 배치 화면. legacy 소스
 * (~/Works/eform/source/signstage/signstage-frontend/src/pages/TemplateEdit.tsx, 라우트
 * `ceremony/:ceremonyId/templates/:templateId/edit`)와 같은 모양으로 만들었다 — 서버가
 * PDFBox로 렌더링한 페이지 PNG를 `react-konva` 캔버스 배경으로 깔고, 서명란을 드래그/
 * 리사이즈/다중선택/정렬할 수 있다. 좌표는 페이지 기준 0~1 비율, 좌상단 원점이다
 * (signstage-backend feature.ceremony.support.SignatureOverlayRenderer와 같은 좌표계).
 *
 * legacy와 달리 페이지 이미지를 `<img src="...">`로 직접 참조하지 못한다 — 우리는 JWT
 * Bearer 헤더 인증이라 `api.getBlob(...)`으로 받아 blob URL로 바꾼 뒤 `useImage`에 넘긴다.
 *
 * "저장"은 legacy와 같은 규약으로 diff 없이 현재 전체 필드 배열을 통째로
 * `PUT .../fields`로 보낸다(백엔드가 기존 서명란을 전부 지우고 다시 채운다) — 그래서 저장
 * 응답으로 받은 새 id로 로컬 tempId를 다시 맞춘다. "설정 완료"를 누르면 서버가 템플릿을
 * 잠그고(TemplateStatus.COMPLETED) 이후 저장은 전부 막힌다(TEMPLATE_LOCKED) — 되돌릴 수 없다.
 */
export const UserTemplateDetail: FC = () => {
  const { organizationId, ceremonyId, templateId } = useParams<{
    organizationId: string;
    ceremonyId: string;
    templateId: string;
  }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const basePath = `/organizations/${organizationId}/ceremonies/${ceremonyId}`;
  const detailPath = `/ceremonies/${organizationId}/${ceremonyId}`;
  const backPath = detailPath;

  const [template, setTemplate] = useState<TemplateSummary | null>(null);
  const [signers, setSigners] = useState<SignerSummary[]>([]);
  const [docSigners, setDocSigners] = useState<SignerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCeremonyCompleted, setIsCeremonyCompleted] = useState(false);
  // 아래 훅들(키보드 삭제/이동, 마퀴 선택)이 이 값을 참조하므로 얼리 리턴보다 먼저 계산해둔다.
  const isReadOnly = template?.status === 'COMPLETED' || isCeremonyCompleted;
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isSaveOverlapConfirmOpen, setIsSaveOverlapConfirmOpen] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 }); // 기본값 A4
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);

  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [img] = useImage(pageImageUrl ?? '');

  const {
    fields,
    setFields,
    selectedTempIds,
    setSelectedTempIds,
    addField,
    removeField,
    removeFields,
    updateField,
    updateFields,
    reset,
  } = useTemplateFieldStore();
  const { undo, redo, clear } = useTemplateFieldStore.temporal.getState();

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  // 드래그 영역(마퀴) 선택: 시각 표시용 사각형(state)과 드래그 중 계산에 쓰는 값(ref)을 분리
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const marqueeStateRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    dragged: boolean;
    additive: boolean;
    baseSelection: string[];
  } | null>(null);
  // 필드는 signerId로 서명자를 참조한다 — fieldName은 저장 시점 스냅샷이라 서명자 이름이
  // 그 뒤 바뀌면 어긋난다. 화면 표시는 항상 현재 서명자 이름을 우선한다.
  const signersById = useMemo(() => new Map(signers.map((signer) => [signer.id, signer])), [signers]);
  const getFieldDisplayName = (field: EditableTemplateField) =>
    field.signerId ? (signersById.get(field.signerId)?.name ?? field.fieldName) : field.fieldName;

  // 페이지별로 겹치는 서명란이 하나라도 있는지(저장/설정완료 시 경고용)
  const hasOverlappingFields = useMemo(() => {
    const byPage = new Map<number, PlacementRect[]>();
    fields.forEach((f) => {
      const list = byPage.get(f.pageIndex) ?? [];
      list.push(f);
      byPage.set(f.pageIndex, list);
    });
    for (const pageFields of byPage.values()) {
      for (let i = 0; i < pageFields.length; i++) {
        for (let j = i + 1; j < pageFields.length; j++) {
          if (rectsOverlap(pageFields[i], pageFields[j])) return true;
        }
      }
    }
    return false;
  }, [fields]);

  const STAGE_WIDTH = BASE_WIDTH * scale;
  const STAGE_HEIGHT = pageSize.width > 0 ? (pageSize.height / pageSize.width) * STAGE_WIDTH : STAGE_WIDTH;
  const BASE_HEIGHT = pageSize.width > 0 ? (pageSize.height / pageSize.width) * BASE_WIDTH : BASE_WIDTH;

  const fetchFields = async () => {
    const response = await api.get(`${basePath}/templates/${templateId}/fields`);
    return response.data as TemplateFieldSummary[];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const [infoRes, templateRes, fieldsData, ceremonyRes, signersRes] = await Promise.all([
          api.get(`${basePath}/templates/${templateId}/info`),
          api.get(`${basePath}/templates/${templateId}`),
          fetchFields(),
          api.get(basePath),
          api.get(`${basePath}/signers`),
        ]);
        if (cancelled) return;

        const info = infoRes.data as TemplateInfo;
        setPageCount(info.pageCount);
        if (info.width && info.height) {
          setPageSize({ width: info.width, height: info.height });
        }

        const templateData = templateRes.data as TemplateSummary;
        setTemplate(templateData);

        const mappedFields: EditableTemplateField[] = fieldsData.map((f) => ({
          ...f,
          tempId: `field-${f.id}`,
        }));
        setFields(mappedFields);

        setIsCeremonyCompleted((ceremonyRes.data as CeremonySummary).status === 'COMPLETED');

        const allSigners = signersRes.data as SignerSummary[];
        setSigners(allSigners);

        const uniqueDocSigners: SignerSummary[] = [];
        const seen = new Set<number>();
        mappedFields.forEach((f) => {
          if (f.signerId && !seen.has(f.signerId)) {
            const signer = allSigners.find((s) => s.id === f.signerId);
            if (signer) {
              uniqueDocSigners.push(signer);
              seen.add(f.signerId);
            }
          }
        });
        setDocSigners(uniqueDocSigners);

        clear();
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '문서 양식 정보를 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, templateId]);

  // 인증된 페이지 이미지를 blob URL로 받아온다 — <img src="..."> 직접 참조는 인증 헤더를 못 붙인다.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await api.getBlob(`${basePath}/templates/${templateId}/pages/${currentPage}?scale=${scale}`);
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setPageImageUrl(objectUrl);
        }
      } catch {
        if (!cancelled) {
          showSnackbar('페이지 이미지를 불러오지 못했습니다.', 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId, templateId, currentPage, scale]);

  useEffect(() => {
    if (trRef.current) {
      const stage = stageRef.current;
      if (!stage) return;
      const nodes = selectedTempIds
        .map((id) => stage.findOne('#' + id))
        .filter((node): node is Konva.Node => node !== undefined);
      trRef.current.nodes(nodes);
      const layer = trRef.current.getLayer();
      if (layer) layer.batchDraw();
    }
  }, [selectedTempIds, currentPage]);

  // 선택된 서명란: Delete/Backspace로 삭제, 방향키(Shift = 큰 폭)로 이동
  useEffect(() => {
    const NUDGE_STEP_PX = 1;
    const NUDGE_STEP_PX_SHIFT = 10;
    const ARROW_DIRECTIONS: Record<string, { dx: number; dy: number }> = {
      ArrowLeft: { dx: -1, dy: 0 },
      ArrowRight: { dx: 1, dy: 0 },
      ArrowUp: { dx: 0, dy: -1 },
      ArrowDown: { dx: 0, dy: 1 },
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly || selectedTempIds.length === 0) return;

      // 입력창(숫자 입력 등)에 포커스가 있을 때는 해당 입력 동작을 우선한다.
      const activeElement = document.activeElement as HTMLElement | null;
      const tagName = activeElement?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeElement?.isContentEditable) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeFields(selectedTempIds);
        return;
      }

      const direction = ARROW_DIRECTIONS[e.key];
      if (!direction) return;

      e.preventDefault();
      const stepPx = e.shiftKey ? NUDGE_STEP_PX_SHIFT : NUDGE_STEP_PX;
      const dxRatio = (direction.dx * stepPx) / BASE_WIDTH;
      const dyRatio = (direction.dy * stepPx) / BASE_HEIGHT;

      const updates = selectedTempIds
        .map((tempId) => fields.find((f) => f.tempId === tempId))
        .filter((f): f is NonNullable<typeof f> => Boolean(f))
        .map((f) => ({
          tempId: f.tempId,
          updates: { xRatio: f.xRatio + dxRatio, yRatio: f.yRatio + dyRatio },
        }));

      if (updates.length > 0) updateFields(updates);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadOnly, selectedTempIds, fields, removeFields, updateFields, BASE_HEIGHT]);

  // 빈 영역(서명란도 Transformer 핸들도 아닌 지점) 클릭 여부 판정.
  // 배경 문서 이미지가 스테이지 전체를 덮고 있어 target이 Stage 자신이 아닌 경우가 많으므로,
  // "선택된 tempId를 가진 서명란인지"로 판정한다.
  const isBackgroundTarget = (target: Konva.Node) => {
    if (target.getParent()?.className === 'Transformer') return false;
    return !fields.some((f) => f.tempId === target.id());
  };

  // 드래그 영역(마퀴) 선택 마무리: mouseup은 스테이지 밖으로 벗어나 놓일 수도 있으므로 window에서 처리
  useEffect(() => {
    const handleWindowMouseUp = () => {
      const marquee = marqueeStateRef.current;
      marqueeStateRef.current = null;
      setSelectionBox(null);
      if (!marquee) return;

      if (!marquee.dragged) {
        // 실제 드래그 없이 빈 영역을 클릭만 한 경우: 기존과 동일하게 선택 해제
        setSelectedTempIds([]);
        return;
      }

      const boxLeft = Math.min(marquee.startX, marquee.currentX);
      const boxRight = Math.max(marquee.startX, marquee.currentX);
      const boxTop = Math.min(marquee.startY, marquee.currentY);
      const boxBottom = Math.max(marquee.startY, marquee.currentY);

      const matchedIds = fields
        .filter((f) => f.pageIndex === currentPage)
        .filter((f) => {
          const left = f.xRatio * STAGE_WIDTH;
          const top = f.yRatio * STAGE_HEIGHT;
          const right = left + f.widthRatio * STAGE_WIDTH;
          const bottom = top + f.heightRatio * STAGE_HEIGHT;
          // 박스 안에 완전히 포함된 서명란만 선택 (일부만 겹치는 것은 제외)
          return left >= boxLeft && right <= boxRight && top >= boxTop && bottom <= boxBottom;
        })
        .map((f) => f.tempId);

      if (matchedIds.length === 0) {
        if (!marquee.additive) setSelectedTempIds([]);
        return;
      }

      setSelectedTempIds(
        marquee.additive ? Array.from(new Set([...marquee.baseSelection, ...matchedIds])) : matchedIds,
      );
    };

    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [fields, currentPage, STAGE_WIDTH, STAGE_HEIGHT, setSelectedTempIds]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center py-24 text-gray-400">
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }
  if (!template) {
    return <div className="p-8 text-center text-gray-500">양식을 찾을 수 없습니다.</div>;
  }

  const visibleFields = fields.filter((f) => f.pageIndex === currentPage);
  const firstSelected = fields.find((f) => f.tempId === selectedTempIds[0]);
  const documentRoleLabel = DOCUMENT_ROLE_LABEL[template.documentRole];

  // 새 서명란의 기본 자리(DEFAULT_FIELD_POSITION)에 이미 다른 서명란이 있으면,
  // handleSpreadFields와 동일한 방식(오른쪽 → 다음 줄 순으로 밀어내기)으로 빈 자리를 찾는다.
  const findFreeDefaultSlot = (widthRatio: number, heightRatio: number) => {
    const GAP_PX = 12;
    const gapXRatio = GAP_PX / BASE_WIDTH;
    const gapYRatio = GAP_PX / BASE_HEIGHT;
    const maxXRatio = 1 - gapXRatio;
    const anchorX = DEFAULT_FIELD_POSITION.xRatio;

    const obstacles = fields.filter((f) => f.pageIndex === currentPage);
    let x = DEFAULT_FIELD_POSITION.xRatio;
    let y = DEFAULT_FIELD_POSITION.yRatio;
    let guard = 0;
    let blocker = obstacles.find((o) => rectsOverlap({ xRatio: x, yRatio: y, widthRatio, heightRatio }, o));
    while (blocker && guard < 100) {
      x = blocker.xRatio + blocker.widthRatio + gapXRatio;
      if (x + widthRatio > maxXRatio) {
        x = anchorX;
        y += heightRatio + gapYRatio;
      }
      blocker = obstacles.find((o) => rectsOverlap({ xRatio: x, yRatio: y, widthRatio, heightRatio }, o));
      guard++;
    }
    return { xRatio: x, yRatio: y };
  };

  const handleAddSignerField = (signer: SignerSummary) => {
    if (isReadOnly) return;
    if (!docSigners.some((s) => s.id === signer.id)) {
      setDocSigners([...docSigners, signer]);
    }

    const nextIndex = fields.length > 0 ? Math.max(...fields.map((f) => f.fieldIndex)) + 1 : 1;
    const tempId = `field-new-${crypto.randomUUID()}`;
    const { widthRatio, heightRatio } = DEFAULT_FIELD_POSITION;
    const { xRatio, yRatio } = findFreeDefaultSlot(widthRatio, heightRatio);
    addField({
      tempId,
      fieldKey: `field-${tempId}`,
      signerId: signer.id,
      pageIndex: currentPage,
      fieldIndex: nextIndex,
      fieldName: signer.name,
      roleCode: signer.roleCode ?? undefined,
      isRequired: true,
      xRatio,
      yRatio,
      widthRatio,
      heightRatio,
    });
  };

  const handleAlign = (type: string) => {
    if (isReadOnly) return;
    if (selectedTempIds.length < 2) return;
    const selectedFields = fields.filter((f) => selectedTempIds.includes(f.tempId));
    const updates: { tempId: string; updates: Partial<EditableTemplateField> }[] = [];

    if (type === 'left') {
      const minX = Math.min(...selectedFields.map((f) => f.xRatio));
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { xRatio: minX } }));
    } else if (type === 'center') {
      const minX = Math.min(...selectedFields.map((f) => f.xRatio));
      const maxX = Math.max(...selectedFields.map((f) => f.xRatio + f.widthRatio));
      const centerX = (minX + maxX) / 2;
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { xRatio: centerX - f.widthRatio / 2 } }));
    } else if (type === 'right') {
      const maxX = Math.max(...selectedFields.map((f) => f.xRatio + f.widthRatio));
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { xRatio: maxX - f.widthRatio } }));
    } else if (type === 'top') {
      const minY = Math.min(...selectedFields.map((f) => f.yRatio));
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { yRatio: minY } }));
    } else if (type === 'middle') {
      const minY = Math.min(...selectedFields.map((f) => f.yRatio));
      const maxY = Math.max(...selectedFields.map((f) => f.yRatio + f.heightRatio));
      const centerY = (minY + maxY) / 2;
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { yRatio: centerY - f.heightRatio / 2 } }));
    } else if (type === 'bottom') {
      const maxY = Math.max(...selectedFields.map((f) => f.yRatio + f.heightRatio));
      selectedFields.forEach((f) => updates.push({ tempId: f.tempId, updates: { yRatio: maxY - f.heightRatio } }));
    }

    updateFields(updates);
  };

  const handleDistribute = (axis: 'horizontal' | 'vertical') => {
    if (isReadOnly) return;
    if (selectedTempIds.length < 3) return;
    const selectedFields = fields.filter((f) => selectedTempIds.includes(f.tempId));
    const updates: { tempId: string; updates: Partial<EditableTemplateField> }[] = [];

    if (axis === 'horizontal') {
      const sorted = [...selectedFields].sort((a, b) => a.xRatio - b.xRatio);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.xRatio + last.widthRatio - first.xRatio;
      const totalWidth = sorted.reduce((sum, f) => sum + f.widthRatio, 0);
      const gap = (totalSpan - totalWidth) / (sorted.length - 1);

      let cursorX = first.xRatio;
      sorted.forEach((f, index) => {
        // 맨 왼쪽/맨 오른쪽은 고정하고 사이 서명란만 간격이 균등하도록 재배치
        if (index > 0 && index < sorted.length - 1) {
          updates.push({ tempId: f.tempId, updates: { xRatio: cursorX } });
        }
        cursorX += f.widthRatio + gap;
      });
    } else {
      const sorted = [...selectedFields].sort((a, b) => a.yRatio - b.yRatio);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpan = last.yRatio + last.heightRatio - first.yRatio;
      const totalHeight = sorted.reduce((sum, f) => sum + f.heightRatio, 0);
      const gap = (totalSpan - totalHeight) / (sorted.length - 1);

      let cursorY = first.yRatio;
      sorted.forEach((f, index) => {
        if (index > 0 && index < sorted.length - 1) {
          updates.push({ tempId: f.tempId, updates: { yRatio: cursorY } });
        }
        cursorY += f.heightRatio + gap;
      });
    }

    if (updates.length > 0) updateFields(updates);
  };

  // 겹쳐 쌓인 서명란(주로 기본 위치에 연속 추가된 경우)을 fieldIndex(추가 순서) 기준으로
  // 겹치지 않게 가로로 순서대로 나열하고, 페이지 폭을 넘으면 다음 줄로 넘긴다.
  // 나열될 자리에 이동 대상이 아닌 다른 서명란이 이미 있으면, 그 서명란을 피해 다음 자리로 밀어낸다.
  const handleSpreadFields = () => {
    if (isReadOnly) return;
    if (selectedTempIds.length < 2) return;
    const selected = fields
      .filter((f) => selectedTempIds.includes(f.tempId))
      .sort((a, b) => a.fieldIndex - b.fieldIndex);

    const GAP_PX = 12;
    const gapXRatio = GAP_PX / BASE_WIDTH;
    const gapYRatio = GAP_PX / BASE_HEIGHT;
    const maxXRatio = 1 - gapXRatio;

    const anchorX = Math.min(...selected.map((f) => f.xRatio));
    const anchorY = Math.min(...selected.map((f) => f.yRatio));

    // 이동 대상이 아닌, 같은 페이지에 이미 놓여 있는 서명란(장애물)
    const obstacles = fields.filter((f) => f.pageIndex === currentPage && !selectedTempIds.includes(f.tempId));
    const overlapsObstacle = (x: number, y: number, w: number, h: number) =>
      obstacles.find((o) => rectsOverlap({ xRatio: x, yRatio: y, widthRatio: w, heightRatio: h }, o));

    let cursorX = anchorX;
    let cursorY = anchorY;
    let rowMaxHeight = 0;
    const updates: { tempId: string; updates: Partial<EditableTemplateField> }[] = [];

    selected.forEach((f) => {
      if (cursorX > anchorX && cursorX + f.widthRatio > maxXRatio) {
        cursorX = anchorX;
        cursorY += rowMaxHeight + gapYRatio;
        rowMaxHeight = 0;
      }

      // 이 자리에 다른 서명란이 이미 있으면, 그 오른쪽으로(필요하면 다음 줄로) 계속 밀어낸다
      let blocker = overlapsObstacle(cursorX, cursorY, f.widthRatio, f.heightRatio);
      let guard = 0;
      while (blocker && guard < 100) {
        cursorX = blocker.xRatio + blocker.widthRatio + gapXRatio;
        if (cursorX + f.widthRatio > maxXRatio) {
          cursorX = anchorX;
          cursorY += rowMaxHeight + gapYRatio;
          rowMaxHeight = 0;
        }
        blocker = overlapsObstacle(cursorX, cursorY, f.widthRatio, f.heightRatio);
        guard++;
      }

      updates.push({ tempId: f.tempId, updates: { xRatio: cursorX, yRatio: cursorY } });
      cursorX += f.widthRatio + gapXRatio;
      rowMaxHeight = Math.max(rowMaxHeight, f.heightRatio);
    });

    updateFields(updates);
  };

  const updateSelectedSize = (w?: number, h?: number) => {
    if (isReadOnly) return;
    if (selectedTempIds.length === 0) return;
    const sizeUpdates: Partial<EditableTemplateField> = {};
    if (w !== undefined && Number.isFinite(w) && w > 0) {
      sizeUpdates.widthRatio = w / STAGE_WIDTH;
    }
    if (h !== undefined && Number.isFinite(h) && h > 0) {
      sizeUpdates.heightRatio = h / STAGE_HEIGHT;
    }
    if (Object.keys(sizeUpdates).length === 0) return;

    updateFields(selectedTempIds.map((tempId) => ({ tempId, updates: sizeUpdates })));
  };

  const handleAddDocSigner = (signer: SignerSummary) => {
    if (isReadOnly) return;
    if (docSigners.some((s) => s.id === signer.id)) return;
    setDocSigners([...docSigners, signer]);
  };

  const handleRemoveDocSigner = (signer: SignerSummary) => {
    if (isReadOnly) return;
    if (fields.some((f) => f.signerId === signer.id)) {
      showSnackbar('배치된 서명란이 있는 서명자는 삭제할 수 없습니다.', 'info');
      return;
    }
    setDocSigners(docSigners.filter((s) => s.id !== signer.id));
  };

  const buildFieldsPayload = (): CreateTemplateFieldRequest[] =>
    fields.map((f) => ({
      fieldKey: f.fieldKey ?? `field-${f.tempId}`,
      signerId: f.signerId ?? null,
      pageIndex: f.pageIndex,
      fieldIndex: f.fieldIndex,
      fieldName: getFieldDisplayName(f),
      roleCode: (f.signerId ? signersById.get(f.signerId)?.roleCode : undefined) ?? f.roleCode ?? null,
      signOrder: f.signOrder ?? null,
      isRequired: f.isRequired ?? true,
      xRatio: f.xRatio,
      yRatio: f.yRatio,
      widthRatio: f.widthRatio,
      heightRatio: f.heightRatio,
    }));

  const executeSave = async () => {
    if (!template || isReadOnly) return;
    setIsSaving(true);
    try {
      const response = await api.put(`${basePath}/templates/${templateId}/fields`, { fields: buildFieldsPayload() });
      const saved = response.data as TemplateFieldSummary[];
      setFields(saved.map((f) => ({ ...f, tempId: `field-${f.id}` })));
      setSelectedTempIds([]);
      showSnackbar('저장되었습니다.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!template || isReadOnly) return;
    if (hasOverlappingFields) {
      setIsSaveOverlapConfirmOpen(true);
      return;
    }
    executeSave();
  };

  const completeTemplateFields = async () => {
    if (!template || isReadOnly) return;
    setIsCompleting(true);
    try {
      await api.put(`${basePath}/templates/${templateId}/fields`, { fields: buildFieldsPayload() });
      const response = await api.post(`${basePath}/templates/${templateId}/complete`, {});
      setTemplate(response.data as TemplateSummary);
      setIsCompleteModalOpen(false);
      showSnackbar('양식 설정이 완료되었습니다.', 'success');
      navigate(backPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : '양식 설정 완료에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleComplete = () => {
    if (!template || isReadOnly) return;
    if (fields.length === 0) {
      showSnackbar('최소 하나 이상의 서명란을 배치해야 합니다.', 'error');
      return;
    }
    setIsCompleteModalOpen(true);
  };

  const toggleSelection = (tempId: string, isShift: boolean) => {
    if (isShift) {
      setSelectedTempIds(
        selectedTempIds.includes(tempId) ? selectedTempIds.filter((id) => id !== tempId) : [...selectedTempIds, tempId],
      );
    } else {
      setSelectedTempIds([tempId]);
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-0 bg-gray-50 -m-6 md:-m-8">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-4">
          <Link to={backPath} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-950">{template.title}</h1>
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 uppercase font-bold">
              {documentRoleLabel}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {!isReadOnly ? (
            <>
              <div className="flex items-center gap-1 border-r border-gray-100 pr-2 mr-2">
                <button onClick={() => undo()} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                  <Undo2 size={16} />
                </button>
                <button onClick={() => redo()} className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                  <Redo2 size={16} />
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || isCompleting}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> 저장
              </button>
              <button
                onClick={handleComplete}
                disabled={isSaving || isCompleting}
                className="bg-gray-950 hover:bg-gray-800 text-white px-4 py-1.5 rounded-lg font-bold transition-colors text-xs disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle2 size={14} /> 설정 완료
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-lg border border-amber-100 text-xs font-bold">
              <Lock size={14} /> 읽기 전용 모드 (수정 불가)
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-6 shadow-sm z-10">
        <div className="flex items-center gap-1 border-r border-gray-100 pr-6">
          <button
            onClick={() => setScale((s) => Math.max(0.5, Number((s - 0.1).toFixed(1))))}
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
          >
            <ZoomOut size={18} />
          </button>
          <div className="flex items-center">
            <input
              type="number"
              value={Math.round(scale * 100)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val)) setScale(val / 100);
              }}
              onBlur={() => {
                if (scale < 0.1) setScale(0.1);
                if (scale > 5) setScale(5);
              }}
              className="w-12 text-center text-xs font-bold bg-transparent border-none outline-none text-gray-700"
            />
            <span className="text-[10px] text-gray-400 mr-1">%</span>
          </div>
          <button
            onClick={() => setScale((s) => Math.min(5, Number((s + 0.1).toFixed(1))))}
            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
          >
            <ZoomIn size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-r border-gray-100 pr-6">
          <button
            disabled={currentPage === 0}
            onClick={() => {
              setCurrentPage((p) => p - 1);
              setSelectedTempIds([]);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-xs font-bold min-w-[70px] text-center">
            PAGE <span className="text-gray-950">{currentPage + 1}</span> / {pageCount}
          </div>
          <button
            disabled={currentPage >= pageCount - 1}
            onClick={() => {
              setCurrentPage((p) => p + 1);
              setSelectedTempIds([]);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-md disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!isReadOnly && (
          <>
            <div className="flex items-center gap-1 border-r border-gray-100 pr-6">
              <button
                onClick={() => handleAlign('left')}
                title="좌측 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignHorizontalJustifyStart size={18} />
              </button>
              <button
                onClick={() => handleAlign('center')}
                title="세로 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignHorizontalJustifyCenter size={18} />
              </button>
              <button
                onClick={() => handleAlign('right')}
                title="우측 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignHorizontalJustifyEnd size={18} />
              </button>
              <div className="w-px h-4 bg-gray-100 mx-1" />
              <button
                onClick={() => handleAlign('top')}
                title="위쪽 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignVerticalJustifyStart size={18} />
              </button>
              <button
                onClick={() => handleAlign('middle')}
                title="가로 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignVerticalJustifyCenter size={18} />
              </button>
              <button
                onClick={() => handleAlign('bottom')}
                title="아래쪽 맞춤"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 2}
              >
                <AlignVerticalJustifyEnd size={18} />
              </button>
              <div className="w-px h-4 bg-gray-100 mx-1" />
              <button
                onClick={() => handleDistribute('horizontal')}
                title="가로 등간격 배치 (3개 이상 선택)"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 3}
              >
                <AlignHorizontalSpaceBetween size={18} />
              </button>
              <button
                onClick={() => handleDistribute('vertical')}
                title="세로 등간격 배치 (3개 이상 선택)"
                className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30"
                disabled={selectedTempIds.length < 3}
              >
                <AlignVerticalSpaceBetween size={18} />
              </button>
              <div className="w-px h-4 bg-gray-100 mx-1" />
              <button
                onClick={handleSpreadFields}
                title="겹친 서명란을 순서대로 나열합니다 (2개 이상 선택)"
                className="px-2.5 py-1.5 hover:bg-gray-100 rounded-md text-gray-600 disabled:opacity-30 text-[11px] font-bold whitespace-nowrap"
                disabled={selectedTempIds.length < 2}
              >
                서명란 펼치기
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400">W</span>
                <input
                  type="number"
                  value={firstSelected ? Math.round(firstSelected.widthRatio * STAGE_WIDTH) : ''}
                  onChange={(e) =>
                    updateSelectedSize(
                      parseInt(e.target.value, 10),
                      firstSelected ? Math.round(firstSelected.heightRatio * STAGE_HEIGHT) : undefined,
                    )
                  }
                  className="w-16 px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400">H</span>
                <input
                  type="number"
                  value={firstSelected ? Math.round(firstSelected.heightRatio * STAGE_HEIGHT) : ''}
                  onChange={(e) =>
                    updateSelectedSize(
                      firstSelected ? Math.round(firstSelected.widthRatio * STAGE_WIDTH) : undefined,
                      parseInt(e.target.value, 10),
                    )
                  }
                  className="w-16 px-2 py-1 border border-gray-200 rounded text-xs outline-none"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center bg-gray-50 border-b border-gray-100">
              <h3 className="font-bold text-gray-950 text-xs">문서 서명자</h3>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {docSigners.length > 0 ? (
                docSigners.map((signer, index) => {
                  const field = fields.find((f) => f.signerId === signer.id);
                  const isPlaced = !!field;
                  const isSelected = field && selectedTempIds.includes(field.tempId);
                  const color = FIELD_COLORS[index % FIELD_COLORS.length];
                  const isCurrentPage = field && field.pageIndex === currentPage;

                  return (
                    <div
                      key={signer.id}
                      className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gray-950 border-gray-950 text-white shadow-md'
                          : isPlaced
                            ? 'bg-blue-50 border-blue-100 hover:border-blue-200'
                            : 'bg-white border-gray-100 hover:border-gray-200'
                      } ${isPlaced && !isCurrentPage && !isSelected ? 'opacity-70' : ''}`}
                      onClick={(e) => {
                        if (isPlaced && field) {
                          if (field.pageIndex !== currentPage) setCurrentPage(field.pageIndex);
                          toggleSelection(field.tempId, e.shiftKey);
                        } else if (!isReadOnly) {
                          handleAddSignerField(signer);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isPlaced ? color.border : '#d1d5db' }} />
                          {isPlaced && field && (
                            <span className="text-[9px] mt-1 font-bold text-gray-400">P.{field.pageIndex + 1}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {signer.name}
                          </span>
                          <span className={`text-[10px] truncate ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                            {signer.affiliation} {signer.position}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isReadOnly &&
                          (isPlaced && field ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(field.tempId);
                              }}
                              className={`p-1 transition-colors ${isSelected ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-red-500'}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveDocSigner(signer);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="문서에서 제외"
                            >
                              <Trash2 size={14} />
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-[10px] text-gray-400">배치할 서명자를 아래 목록에서 추가해주세요.</p>
                </div>
              )}
            </div>

            {!isReadOnly && (
              <div className="border-t border-gray-100 flex flex-col h-1/2 overflow-hidden">
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <UserPlus size={14} className="text-gray-500" />
                  <h3 className="font-bold text-gray-950 text-xs">협약 서명자 추가</h3>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-2 bg-gray-50/30">
                  {signers.filter((s) => !docSigners.some((ds) => ds.id === s.id)).length > 0 ? (
                    signers
                      .filter((s) => !docSigners.some((ds) => ds.id === s.id))
                      .map((signer) => (
                        <div
                          key={signer.id}
                          className="p-3 bg-white border border-gray-100 rounded-xl flex items-center justify-between hover:border-gray-300 transition-all group"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-gray-900 truncate">{signer.name}</span>
                            <span className="text-[10px] text-gray-500 truncate">
                              {signer.affiliation} {signer.position}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAddDocSigner(signer)}
                            className="p-1 bg-gray-100 text-gray-500 rounded hover:bg-gray-950 hover:text-white transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-[10px] text-gray-400">추가할 수 있는 서명자가 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-start justify-center p-12 bg-gray-200 relative">
          <div className="bg-white shadow-2xl relative">
            <Stage
              width={STAGE_WIDTH}
              height={STAGE_HEIGHT}
              ref={stageRef}
              onMouseDown={(e) => {
                if (isBackgroundTarget(e.target)) {
                  const pos = e.target.getStage()?.getPointerPosition();
                  if (!pos) return;
                  marqueeStateRef.current = {
                    startX: pos.x,
                    startY: pos.y,
                    currentX: pos.x,
                    currentY: pos.y,
                    dragged: false,
                    additive: e.evt.shiftKey,
                    baseSelection: selectedTempIds,
                  };
                  setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
                  return;
                }
                if (e.target.getParent()?.className !== 'Transformer') {
                  toggleSelection(e.target.id(), e.evt.shiftKey);
                }
              }}
              onMouseMove={(e) => {
                const marquee = marqueeStateRef.current;
                if (!marquee) return;
                const pos = e.target.getStage()?.getPointerPosition();
                if (!pos) return;
                marquee.currentX = pos.x;
                marquee.currentY = pos.y;
                if (!marquee.dragged && (Math.abs(pos.x - marquee.startX) > 3 || Math.abs(pos.y - marquee.startY) > 3)) {
                  marquee.dragged = true;
                }
                setSelectionBox({
                  x: Math.min(marquee.startX, pos.x),
                  y: Math.min(marquee.startY, pos.y),
                  width: Math.abs(pos.x - marquee.startX),
                  height: Math.abs(pos.y - marquee.startY),
                });
              }}
            >
              <Layer>
                {img && <KonvaImage image={img} width={STAGE_WIDTH} height={STAGE_HEIGHT} />}
                {visibleFields.map((field) => {
                  const color = FIELD_COLORS[field.fieldIndex % FIELD_COLORS.length];
                  const isSelected = selectedTempIds.includes(field.tempId);
                  return (
                    <Fragment key={field.tempId}>
                      <Rect
                        id={field.tempId}
                        x={field.xRatio * STAGE_WIDTH}
                        y={field.yRatio * STAGE_HEIGHT}
                        width={field.widthRatio * STAGE_WIDTH}
                        height={field.heightRatio * STAGE_HEIGHT}
                        fill={color.bg}
                        stroke={isSelected ? '#000' : color.border}
                        strokeWidth={isSelected ? 3 : 2}
                        draggable={!isReadOnly}
                        onDragEnd={(e) => {
                          const nodes = trRef.current?.nodes() ?? [];
                          if (nodes.length > 1) {
                            const batch = nodes.map((node) => ({
                              tempId: node.id(),
                              updates: { xRatio: node.x() / STAGE_WIDTH, yRatio: node.y() / STAGE_HEIGHT },
                            }));
                            updateFields(batch);
                          } else {
                            updateField(field.tempId, { xRatio: e.target.x() / STAGE_WIDTH, yRatio: e.target.y() / STAGE_HEIGHT });
                          }
                        }}
                        onTransformEnd={() => {
                          const nodes = trRef.current?.nodes() ?? [];
                          const batch = nodes.map((node) => ({
                            tempId: node.id(),
                            updates: {
                              xRatio: node.x() / STAGE_WIDTH,
                              yRatio: node.y() / STAGE_HEIGHT,
                              widthRatio: (node.width() * node.scaleX()) / STAGE_WIDTH,
                              heightRatio: (node.height() * node.scaleY()) / STAGE_HEIGHT,
                            },
                          }));
                          updateFields(batch);
                          nodes.forEach((node) => {
                            node.scaleX(1);
                            node.scaleY(1);
                          });
                        }}
                      />
                      <Text
                        x={field.xRatio * STAGE_WIDTH + 5}
                        y={field.yRatio * STAGE_HEIGHT + 5}
                        text={getFieldDisplayName(field)}
                        fontSize={11}
                        fill={isSelected ? '#000' : color.text}
                        fontStyle="bold"
                        listening={false}
                      />
                    </Fragment>
                  );
                })}
                {!isReadOnly && (
                  <Transformer
                    ref={trRef}
                    rotateEnabled={false}
                    keepRatio={false}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    anchorStroke="#000"
                    anchorFill="#fff"
                    borderStroke="#000"
                    borderDash={[3, 3]}
                  />
                )}
                {selectionBox && (
                  <Rect
                    x={selectionBox.x}
                    y={selectionBox.y}
                    width={selectionBox.width}
                    height={selectionBox.height}
                    fill="rgba(59, 130, 246, 0.08)"
                    stroke="#3b82f6"
                    strokeWidth={1}
                    dash={[4, 4]}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isCompleteModalOpen}
        title="서명란 설정을 완료하시겠습니까?"
        message={
          hasOverlappingFields
            ? '설정 완료 후에는 이 문서 양식의 서명란을 수정할 수 없습니다. 서로 겹쳐 있는 서명란이 있으니 완료 전에 위치를 다시 한번 확인해주세요.'
            : '설정 완료 후에는 이 문서 양식의 서명란을 수정할 수 없습니다.'
        }
        confirmLabel="설정 완료"
        isSubmitting={isCompleting}
        onConfirm={completeTemplateFields}
        onCancel={() => setIsCompleteModalOpen(false)}
      />

      <ConfirmDialog
        open={isSaveOverlapConfirmOpen}
        title="겹치는 서명란이 있습니다"
        message="서로 겹쳐 있는 서명란이 있습니다. 이대로 저장하시겠습니까?"
        confirmLabel="저장"
        isSubmitting={isSaving}
        onConfirm={() => {
          setIsSaveOverlapConfirmOpen(false);
          executeSave();
        }}
        onCancel={() => setIsSaveOverlapConfirmOpen(false)}
      />
    </div>
  );
};
