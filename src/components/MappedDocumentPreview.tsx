import { Fragment, useEffect, useState } from 'react';
import type { FC } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line } from 'react-konva';
import useImage from 'use-image';
import { ChevronLeft, ChevronRight, FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import type { StrokeSummary, TemplateFieldSummary } from '../types';

const BASE_WIDTH = 500;

/**
 * 스트로크의 `rawData`(필드 박스 기준 0~1 좌표 JSON 배열)를 캔버스 절대 좌표로 바꾼다 —
 * legacy `CeremonyControl.tsx`와 같은 공식(`field.xRatio + p*field.widthRatio`). 파싱에
 * 실패하면 null을 돌려주고 호출부가 그 스트로크를 건너뛴다.
 */
const parseStrokePoints = (
  rawData: string,
  field: TemplateFieldSummary,
  stageWidth: number,
  stageHeight: number,
): number[] | null => {
  try {
    const raw = JSON.parse(rawData) as [number, number][];
    return raw.flatMap(([x, y]) => [
      (field.xRatio + x * field.widthRatio) * stageWidth,
      (field.yRatio + y * field.heightRatio) * stageHeight,
    ]);
  } catch {
    return null;
  }
};

/**
 * legacy(~/Works/eform/source/signstage/signstage-frontend)의 `CeremonyEventDetail.tsx`
 * (문서 매핑, sub/11)와 `CeremonyControl.tsx`(행사제어, sub/10/control)가 각자 따로 구현하던
 * "PDF 페이지 위에 서명란을 오버레이로 보여주는" 렌더링을 하나로 합친 공용 컴포넌트다 — 세
 * 화면(하위 행사 상세의 문서 매핑 섹션, 행사제어, 프로젝터)이 전부 이걸 쓴다.
 *
 * 페이지 이미지를 blob으로 가져오는 방식(JWT 인증 vs eventAccessKey 공개)이 화면마다 달라
 * `fetchPage`를 호출부에서 주입받는다 — 이 컴포넌트 자신은 인증 방식을 모른다.
 *
 * `strokes`를 넘기면 실시간 펜 궤적을 Konva Line으로 그린다(행사제어/프로젝터). 넘기지 않으면
 * 필드 오버레이만 보여주는 정적 미리보기가 된다(문서 매핑 섹션 — 아직 서명 전이라 스트로크가
 * 의미 없다).
 */
interface MappedDocumentPreviewProps {
  label: string;
  fields: TemplateFieldSummary[];
  signerNameById: Map<number, string>;
  fetchPage: (pageIndex: number, scale: number) => Promise<Blob>;
  pageCount: number;
  strokes?: StrokeSummary[];
  emptyMessage: string;
}

export const MappedDocumentPreview: FC<MappedDocumentPreviewProps> = ({
  label,
  fields,
  signerNameById,
  fetchPage,
  pageCount,
  strokes,
  emptyMessage,
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [img] = useImage(pageImageUrl ?? '');

  const stageWidth = BASE_WIDTH * scale;
  // 원본 PDF 페이지 비율을 몰라도(fields만 있어도) 렌더링은 가능하다 — 이미지가 로드되면
  // 그 실제 비율로 캔버스 높이를 맞춘다. 아직 로드 전이면 A4 비율(1:1.414)로 임시 표시한다.
  const stageHeight = img ? stageWidth * (img.height / img.width) : stageWidth * 1.414;

  // 매핑된 템플릿이 바뀌면(fields 참조가 바뀌면) 페이지 수도 같이 바뀌므로 currentPage를
  // 렌더링 시점에 그냥 클램프한다 — 별도 reset effect 없이 UserTemplateDetail의
  // `Math.min(page, totalPages)` 패턴과 같다.
  const safePage = pageCount > 0 ? Math.min(currentPage, pageCount - 1) : 0;

  useEffect(() => {
    if (pageCount === 0) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setIsLoading(true);
      try {
        const blob = await fetchPage(safePage, 1.5);
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setPageImageUrl(objectUrl);
        }
      } catch {
        // 페이지 이미지를 못 불러와도 필드 오버레이 자체는 의미가 있어 화면을 막지 않는다 —
        // 회색 배경 위에 오버레이만 뜬다.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
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
  }, [safePage, pageCount]);

  const visibleFields = fields.filter((f) => f.pageIndex === safePage);

  // 서명자가 이 문서가 아닌 다른 매핑 문서(대개 CONTRACT)에 그린 스트로크도 같은 서명자의
  // 이 문서 필드로 대신 그린다 — legacy `ProjectorView.tsx`의
  // `fieldById.get(stroke.fieldId) ?? fieldBySignerId.get(stroke.signerId)`와 같은 방식이다.
  // 두 문서(CONTRACT/EXHIBITION)는 서로 다른 Template이라 필드 id가 겹치지 않으므로, id로
  // 못 찾으면 signerId로 이 문서의 필드를 대신 찾는다(획의 0~1 상대좌표는 그대로 두고 앉힐
  // 박스만 바꾼다).
  const fieldBySignerId = new Map<number, TemplateFieldSummary>();
  fields.forEach((field) => {
    if (field.signerId != null && !fieldBySignerId.has(field.signerId)) {
      fieldBySignerId.set(field.signerId, field);
    }
  });

  const strokesByField = new Map<number, StrokeSummary[]>();
  (strokes ?? []).forEach((stroke) => {
    const fieldId = fields.some((f) => f.id === stroke.templateFieldId)
      ? stroke.templateFieldId
      : fieldBySignerId.get(stroke.signerId)?.id;
    if (fieldId == null) return;
    const list = strokesByField.get(fieldId) ?? [];
    list.push(stroke);
    strokesByField.set(fieldId, list);
  });

  if (pageCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-lg border border-gray-200">
        <FileText size={28} className="mb-2 opacity-40" />
        <p className="text-xs font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-gray-200">
        <span className="text-[11px] font-bold text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-bold text-gray-500 min-w-[28px] text-center">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
              className="p-1 hover:bg-white rounded-md"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] font-bold w-9 text-center text-gray-500">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              className="p-1 hover:bg-white rounded-md"
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 rounded-xl border border-gray-300 overflow-auto flex items-center justify-center p-4 relative min-h-[240px]">
        {isLoading && !img && <Loader2 size={24} className="animate-spin text-gray-400" />}
        <div className="bg-white shadow-2xl relative" style={{ width: stageWidth, height: stageHeight }}>
          <Stage width={stageWidth} height={stageHeight}>
            <Layer>
              {img && <KonvaImage image={img} width={stageWidth} height={stageHeight} />}
              {visibleFields.map((field) => {
                const signerName = field.signerId != null ? signerNameById.get(field.signerId) : undefined;
                const fieldStrokes = strokesByField.get(field.id) ?? [];
                const hasStroke = fieldStrokes.length > 0;
                const borderColor = hasStroke ? '#10b981' : '#f59e0b';

                return (
                  <Fragment key={field.id}>
                    <Rect
                      x={field.xRatio * stageWidth}
                      y={field.yRatio * stageHeight}
                      width={field.widthRatio * stageWidth}
                      height={field.heightRatio * stageHeight}
                      stroke={borderColor}
                      strokeWidth={2}
                      fill={hasStroke ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)'}
                      listening={false}
                    />
                    <Text
                      x={field.xRatio * stageWidth + 4}
                      y={field.yRatio * stageHeight + 4}
                      text={signerName ?? field.roleCode ?? field.fieldName ?? '서명란'}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#ffffff"
                      padding={2}
                      listening={false}
                    />
                    {fieldStrokes.map((stroke) => {
                      const points = parseStrokePoints(stroke.rawData, field, stageWidth, stageHeight);
                      if (!points) return null;
                      return (
                        <Line
                          key={stroke.id}
                          points={points}
                          stroke="#111827"
                          strokeWidth={2}
                          tension={0.5}
                          lineCap="round"
                          lineJoin="round"
                          listening={false}
                        />
                      );
                    })}
                  </Fragment>
                );
              })}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
};
