import { useEffect, useRef, useState } from 'react';
import type { FC, PointerEvent as ReactPointerEvent } from 'react';

interface SignaturePadProps {
  /** 이미 서버에 저장된 획들(0~1 정규화, 캔버스=필드 박스 기준). 부모가 소유한다(controlled). */
  strokes: [number, number][][];
  /** 한 획(pointerdown→pointerup)을 다 그리면 호출된다. 저장 성공 시 부모가 `strokes`에 추가해야
   * 다시 그려진다 — 실패하면 그냥 사라진다(별도 롤백 로직 없이 자연스러운 되돌림). */
  onStrokeComplete: (points: [number, number][]) => void;
  disabled?: boolean;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 120;

/**
 * 서명란 하나에 대응하는 독립 서명 패드. 캔버스 자체를 그 서명란의 바운딩 박스로 간주하고,
 * 캔버스 기준 0~1 정규화 좌표(좌상단 원점)로 점을 기록한다 — `StrokeData.rawData` 계약
 * (signstage-backend feature.ceremony.support.SignatureOverlayRenderer)과 그대로 맞는다.
 */
export const SignaturePad: FC<SignaturePadProps> = ({
  strokes,
  onStrokeComplete,
  disabled = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][] | null>(null);
  const isDrawingRef = useRef(false);
  // 그리는 중인 점을 여기에도 따로 들고 있는다 — pointerup 핸들러에서 onStrokeComplete(네트워크
  // 호출)를 실행해야 하는데, setState 업데이터 함수 안에서 부수효과를 실행하면 React 19
  // StrictMode가 업데이터를 일부러 두 번 호출해 부수효과도 중복 실행된다(같은 획이 서버에
  // 두 번 저장되는 버그로 실제 발견됨). ref는 StrictMode 이중 호출 대상이 아니라 안전하다.
  const drawingPointsRef = useRef<[number, number][] | null>(null);

  // strokes(커밋된 획)나 drawingPoints(그리는 중인 획)가 바뀔 때마다 캔버스를 처음부터 다시 그린다.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = drawingPoints ? [...strokes, drawingPoints] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      stroke.forEach(([x, y], i) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();
    }
  }, [strokes, drawingPoints]);

  const toPoint = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return [x, y];
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const points: [number, number][] = [toPoint(e)];
    drawingPointsRef.current = points;
    setDrawingPoints(points);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const points = [...(drawingPointsRef.current ?? []), toPoint(e)];
    drawingPointsRef.current = points;
    setDrawingPoints(points);
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const finished = drawingPointsRef.current;
    drawingPointsRef.current = null;
    setDrawingPoints(null);
    if (finished && finished.length >= 2) {
      onStrokeComplete(finished);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`border border-gray-200 rounded-lg touch-none ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white cursor-crosshair'}`}
      style={{ width, height }}
    />
  );
};
