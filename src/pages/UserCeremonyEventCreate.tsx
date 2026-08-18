import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonyEventSummary, CeremonyEventType } from '../types';

/**
 * 하위 행사(CeremonyEvent) 등록 화면. TEST/MAIN 두 유형이 있고(signstage-docs
 * business/ceremony-feature-migration-review.md 2.2절), 생성 시점엔 `DRAFT` 상태로 시작한다 —
 * 문서 매핑/서명자 배정을 마쳐야 `READY`로 전이할 수 있다(2·3라운드 이후).
 */
export const UserCeremonyEventCreate: FC = () => {
  const { organizationId, ceremonyId } = useParams<{ organizationId: string; ceremonyId: string }>();
  const navigate = useNavigate();
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);

  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<CeremonyEventType>('TEST');
  const [venue, setVenue] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showSnackbar('하위 행사 이름을 입력해주세요.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post(`/organizations/${organizationId}/ceremonies/${ceremonyId}/events`, {
        name: name.trim(),
        eventType,
        venue: venue.trim() || null,
        scheduledStartAt: scheduledStartAt || null,
        scheduledEndAt: scheduledEndAt || null,
        description: description.trim() || null,
      });
      const created = response.data as CeremonyEventSummary;
      showSnackbar('하위 행사가 등록되었습니다.', 'success');
      navigate(`${detailPath}/events/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '하위 행사 등록에 실패했습니다.';
      showSnackbar(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Link to={detailPath} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-950 mb-4">
        <ArrowLeft size={16} />
        행사 상세로
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950">하위 행사 등록</h1>
        <p className="mt-1 text-sm text-gray-500">테스트 행사는 리허설용, 본행사가 실제 진행되는 하위 행사입니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
          <div className="flex gap-2">
            {(['TEST', 'MAIN'] as CeremonyEventType[]).map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setEventType(type)}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  eventType === type ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {type === 'TEST' ? '테스트' : '본행사'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            placeholder="예: 1차 리허설"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            placeholder="선택 입력"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">예정 시작</label>
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">예정 종료</label>
            <input
              type="datetime-local"
              value={scheduledEndAt}
              onChange={(e) => setScheduledEndAt(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-950/10 focus:border-gray-400 outline-none transition-all text-sm disabled:bg-gray-50"
            placeholder="선택 입력"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gray-950 hover:bg-gray-800 text-white font-bold py-2 rounded-lg transition-colors shadow-sm text-sm disabled:bg-gray-400"
        >
          {isLoading ? '등록 중...' : '하위 행사 등록'}
        </button>
      </form>
    </div>
  );
};
