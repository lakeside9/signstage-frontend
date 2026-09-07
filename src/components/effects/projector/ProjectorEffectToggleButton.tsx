import type React from 'react';
import { Sparkles } from 'lucide-react';

type Props = {
  enabled: boolean;
  visible: boolean;
  onToggle: () => void;
};

export const ProjectorEffectToggleButton: React.FC<Props> = ({ enabled, visible, onToggle }) => {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-black transition-colors ${
        enabled ? 'bg-amber-400 text-gray-950 hover:bg-amber-300' : 'bg-white/10 text-white/65 hover:bg-white/20'
      }`}
      title="현재 전시 브라우저의 효과만 켜거나 끕니다."
    >
      <Sparkles size={15} />
      효과 {enabled ? '켜짐' : '꺼짐'}
    </button>
  );
};
