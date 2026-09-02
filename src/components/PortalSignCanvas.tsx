import { Fragment, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Line, Image as KonvaImage, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';

interface RenderedStroke {
  points?: number[];
  color?: string;
  width?: number;
  // 서명매핑확인(테스트/리허설 전용, 2026-09-02 legacy 포팅) 자동 서명 — 손글씨 대신
  // 소속명을 텍스트로 표시한다. text가 있으면 points는 없고, boxX/boxY/boxWidth/boxHeight
  // (서명란 박스, 0~1 비율)로 가운데 정렬해 그린다.
  text?: string;
  boxX?: number;
  boxY?: number;
  boxWidth?: number;
  boxHeight?: number;
}

interface SignatureFieldOverlay {
  id: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  isMine?: boolean;
  isActive?: boolean;
  isSigned?: boolean;
  canSign?: boolean;
}

interface PortalSignCanvasProps {
  width: number;
  height: number;
  backgroundImage?: string;
  strokes: RenderedStroke[];
  onDrawEnd?: (points: number[]) => void;
  readOnly?: boolean;
  scale?: number;
  signatureFields?: SignatureFieldOverlay[];
  onSignatureFieldClick?: (fieldId: number) => void;
}

/**
 * legacy(~/Works/eform/source/signstage/signstage-frontend) `SignCanvas.tsx`를 그대로
 * 포팅했다 — 서명자 포털이 두 가지 용도로 같이 쓴다: (1) 서명용(CONTRACT) 문서 전체를
 * 배경으로 깔고 그 위에 모든 서명란을 클릭 가능한 오버레이로 보여주는 읽기 전용 모드
 * (`signatureFields`+`onSignatureFieldClick`, `onDrawEnd` 없음), (2) 서명 모달 안의 빈 서명
 * 패드(배경/오버레이 없이 `onDrawEnd`만). legacy의 `editableArea`(모달을 문서 위 특정 박스로
 * 제한하는 옵션)는 실제로는 어느 호출부도 쓰지 않아 포팅하지 않았다.
 *
 * 좌표는 전부 0~1 정규화(캔버스 기준) — `points`는 `[x0,y0,x1,y1,...]` 형태의 flat 배열이다.
 */
export const PortalSignCanvas: FC<PortalSignCanvasProps> = ({
  width,
  height,
  backgroundImage,
  strokes,
  onDrawEnd,
  readOnly = false,
  scale = 1,
  signatureFields = [],
  onSignatureFieldClick,
}) => {
  const [img] = useImage(backgroundImage || '');
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const container = stageRef.current?.container?.();
    if (!container) return;
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';
  }, []);

  const normalizePoint = (point: { x: number; y: number }) => ({ x: point.x / width, y: point.y / height });

  const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (readOnly) return;
    e.evt?.preventDefault?.();
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    isDrawing.current = true;
    const normalized = normalizePoint(pos);
    setCurrentPoints([normalized.x, normalized.y]);
  };

  const handlePointerMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing.current || readOnly) return;
    e.evt?.preventDefault?.();
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    const normalized = normalizePoint(pos);
    setCurrentPoints((prev) => [...prev, normalized.x, normalized.y]);
  };

  const handlePointerUp = (e?: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawing.current || readOnly) return;
    e?.evt?.preventDefault?.();
    isDrawing.current = false;
    if (onDrawEnd && currentPoints.length > 2) {
      onDrawEnd(currentPoints);
    }
    setCurrentPoints([]);
  };

  const setCursor = (cursor: string) => {
    const container = stageRef.current?.container?.();
    if (container) container.style.cursor = cursor;
  };

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
      style={{ backgroundColor: '#fff', touchAction: 'none', userSelect: 'none' }}
    >
      <Layer>
        {img && <KonvaImage image={img} width={width} height={height} />}

        {strokes.map((stroke, i) => (
          stroke.text != null ? (
            <Text
              key={i}
              x={(stroke.boxX ?? 0) * width}
              y={(stroke.boxY ?? 0) * height}
              width={(stroke.boxWidth ?? 1) * width}
              height={(stroke.boxHeight ?? 1) * height}
              text={stroke.text}
              align="center"
              verticalAlign="middle"
              fontSize={Math.max(8, (stroke.boxHeight ?? 0.1) * height * 0.55)}
              fontStyle="bold"
              fill={stroke.color || '#000'}
            />
          ) : (
            <Line
              key={i}
              points={(stroke.points ?? []).map((p, idx) => (idx % 2 === 0 ? p * width : p * height))}
              stroke={stroke.color || '#000'}
              strokeWidth={(stroke.width || 2) * scale}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          )
        ))}

        {currentPoints.length > 0 && (
          <Line
            points={currentPoints.map((p, idx) => (idx % 2 === 0 ? p * width : p * height))}
            stroke="#000"
            strokeWidth={2 * scale}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {signatureFields.map((field) => {
          const x = field.xRatio * width;
          const y = field.yRatio * height;
          const fieldWidth = field.widthRatio * width;
          const fieldHeight = field.heightRatio * height;
          const borderWidth = field.isMine ? Math.max(1, 4 * scale) : Math.max(1, 2 * scale);
          const hasLabel = !field.isSigned;
          const labelWidth = Math.min(fieldWidth, Math.max(44 * scale, 42));
          const labelHeight = Math.min(fieldHeight, Math.max(18 * scale, 16));
          const labelX = x + Math.max(0, (fieldWidth - labelWidth) / 2);
          const labelY = y + Math.max(0, (fieldHeight - labelHeight) / 2);
          const canClick = Boolean(field.isMine && onSignatureFieldClick);
          const handleFieldClick = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
            event.cancelBubble = true;
            if (canClick && onSignatureFieldClick) onSignatureFieldClick(field.id);
          };

          return (
            <Fragment key={field.id}>
              <Rect
                x={x}
                y={y}
                width={fieldWidth}
                height={fieldHeight}
                stroke={field.isMine ? '#f97316' : 'rgba(107, 114, 128, 0.9)'}
                strokeWidth={borderWidth}
                dash={field.isMine ? undefined : [6 * scale, 4 * scale]}
                fill={field.isMine ? (field.isSigned ? 'transparent' : 'rgba(254, 240, 138, 0.92)') : 'rgba(156, 163, 175, 0.2)'}
                opacity={field.isMine && field.canSign ? 1 : 0.55}
                shadowColor={field.isMine && field.canSign && !field.isSigned ? 'rgba(250, 204, 21, 0.9)' : undefined}
                shadowBlur={field.isMine && field.canSign && !field.isSigned ? 24 * scale : 0}
                shadowOpacity={field.isMine && field.canSign && !field.isSigned ? 0.9 : 0}
                listening={canClick}
                onClick={handleFieldClick}
                onTap={handleFieldClick}
                onMouseEnter={() => canClick && setCursor('pointer')}
                onMouseLeave={() => setCursor('default')}
              />
              {hasLabel && (
                <>
                  <Rect
                    x={labelX}
                    y={labelY}
                    width={labelWidth}
                    height={labelHeight}
                    cornerRadius={Math.max(3, 4 * scale)}
                    fill={field.isMine && field.isActive && field.canSign ? '#ea580c' : field.isMine ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'}
                    stroke={field.isMine ? '#c2410c' : '#9ca3af'}
                    strokeWidth={Math.max(1, scale)}
                    listening={canClick}
                    onClick={handleFieldClick}
                    onTap={handleFieldClick}
                    onMouseEnter={() => canClick && setCursor('pointer')}
                    onMouseLeave={() => setCursor('default')}
                  />
                  <Text
                    x={labelX}
                    y={labelY + Math.max(1, 2 * scale)}
                    width={labelWidth}
                    height={labelHeight}
                    text={field.isMine ? '👆 서명' : '서명란'}
                    align="center"
                    verticalAlign="middle"
                    fontSize={Math.max(6, 10 * scale)}
                    fontStyle="bold"
                    fill={field.isMine && field.isActive && field.canSign ? '#ffffff' : field.isMine ? '#c2410c' : '#4b5563'}
                    listening={canClick}
                    onClick={handleFieldClick}
                    onTap={handleFieldClick}
                    onMouseEnter={() => canClick && setCursor('pointer')}
                    onMouseLeave={() => setCursor('default')}
                  />
                </>
              )}
            </Fragment>
          );
        })}
      </Layer>
    </Stage>
  );
};
