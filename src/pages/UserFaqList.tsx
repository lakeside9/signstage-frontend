import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, Loader2 } from 'lucide-react';
import { SanitizedHtml } from '../components/SanitizedHtml';
import { useSnackbarStore } from '../store/useSnackbarStore';
import { api } from '../utils/api';
import type { FaqSummary } from '../types';

/**
 * FAQ(파트너 쪽 조회) — signstage-docs business/partner-support-center-review.md 4.3절.
 * 조직 스코프가 없는 전역 카탈로그 조회라 API는 카테고리별로 그룹핑하지 않은 평평한
 * 목록을 내려주고(9장 결정 #3), 카테고리별 아코디언 그룹핑은 이 화면이 한다. `answer`는
 * 관리자가 `HtmlEditor.tsx`로 작성한 HTML 문자열이라 `SanitizedHtml.tsx`로 렌더링한다
 * (2026-09-12 사용자 요청).
 */
export const UserFaqList: FC = () => {
  const showSnackbar = useSnackbarStore((state) => state.showSnackbar);
  const [faqs, setFaqs] = useState<FaqSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/faqs');
        if (!cancelled) setFaqs(response.data as FaqSummary[]);
      } catch (err) {
        if (!cancelled) showSnackbar(err instanceof Error ? err.message : 'FAQ를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = faqs.reduce<Record<string, FaqSummary[]>>((acc, faq) => {
    const key = faq.category ?? '일반';
    (acc[key] ??= []).push(faq);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
          <HelpCircle size={20} className="text-gray-400" />
          FAQ
        </h1>
        <p className="mt-1 text-sm text-gray-500">자주 묻는 질문을 모았습니다.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : faqs.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">등록된 FAQ가 없습니다.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-2 text-xs font-bold uppercase text-gray-400">{category}</h2>
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {items.map((faq) => {
                  const isOpen = openId === faq.id;
                  return (
                    <div key={faq.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : faq.id)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span className="text-sm font-medium text-gray-950">{faq.question}</span>
                        {isOpen ? (
                          <ChevronUp size={16} className="shrink-0 text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="shrink-0 text-gray-400" />
                        )}
                      </button>
                      {isOpen && <SanitizedHtml html={faq.answer} className="px-4 pb-4 text-sm text-gray-600" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
