import { useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 팝업 폭. 확인창처럼 좁게 쓰고 싶으면 'max-w-sm' 등으로 좁혀서 넘긴다. */
  widthClassName?: string;
}

/**
 * 화면 어디서든 쓰는 공용 팝업(모달). 배경 클릭이나 ESC로 닫힌다. 인라인 확장 행 대신
 * 수정 폼/삭제 확인처럼 화면 흐름과 분리된 팝업이 필요한 곳에 쓴다(UserCeremonyDetail의
 * 서명자/문서 양식/하위 행사 관리가 첫 사용처).
 */
export const Modal: FC<ModalProps> = ({ open, onClose, title, children, widthClassName = 'max-w-md' }) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative w-full ${widthClassName} bg-white rounded-lg shadow-xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-950">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-950" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};
