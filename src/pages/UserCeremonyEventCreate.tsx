import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, SquareCheckBig } from 'lucide-react';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { CeremonyEventSummary, CeremonyEventType, OptionalFeatureSummary } from '../types';

/**
 * 하위 행사(CeremonyEvent) 등록 화면. TEST/MAIN 두 유형이 있고(signstage-docs
 * business/ceremony-feature-migration-review.md 2.2절), 생성 시점엔 `DRAFT` 상태로 시작한다 —
 * 문서 매핑/서명자 배정을 마쳐야 `READY`로 전이할 수 있다(2·3라운드 이후).
 *
 * 적용 선택옵션은 이전에는 등록 후 상세 화면에서만 켤 수 있었는데, 이번에 등록 시점에
 * 바로 적용할 수 있게 추가했다(수정 화면도 동일 — `UserCeremonyDetail.tsx`의 "하위 행사
 * 수정" 모달 참고). 목록은 이 행사 마스터가 실제로 쓸 수 있는(플랜 포함분 + 승인된
 * 추가구매) 옵션만 `/available-optional-features`로 걸러서 보여준다.
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

  const [availableFeatures, setAvailableFeatures] = useState<OptionalFeatureSummary[]>([]);
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(true);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);

  const detailPath = `/org/ceremonies/${organizationId}/${ceremonyId}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get(
          `/organizations/${organizationId}/ceremonies/${ceremonyId}/available-optional-features`,
        );
        if (!cancelled) {
          setAvailableFeatures(response.data as OptionalFeatureSummary[]);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '선택옵션을 불러오지 못했습니다.';
          showSnackbar(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setIsFeaturesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, ceremonyId]);

  const toggleFeature = (featureId: number) => {
    setSelectedFeatureIds((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    );
  };

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
        optionalFeatureIds: selectedFeatureIds,
      });
      const created = response.data as CeremonyEventSummary;
      showSnackbar('하위 행사가 등록되었습니다.', 'success');
      navigate(`${detailPath}/events/${created.id}/mapping`);
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">적용 선택옵션</label>
          {isFeaturesLoading ? (
            <p className="text-xs text-gray-400">불러오는 중...</p>
          ) : availableFeatures.length === 0 ? (
            <p className="text-xs text-gray-400">적용할 수 있는 선택옵션이 없습니다. 구매는 행사 상세 화면에서 합니다.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg px-3">
              {availableFeatures.map((feature) => (
                <li key={feature.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleFeature(feature.id)}
                    disabled={isLoading}
                    className="shrink-0 text-gray-950"
                  >
                    <SquareCheckBig
                      size={18}
                      className={selectedFeatureIds.includes(feature.id) ? 'text-gray-950' : 'text-gray-300'}
                    />
                  </button>
                  <span className="text-sm text-gray-950">{feature.name}</span>
                </li>
              ))}
            </ul>
          )}
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
