import { useEffect, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, MessageSquare, X } from 'lucide-react';
import {
  COMPARISON_ROWS,
  FEATURE_CHIPS,
  FEATURES,
  INTRO_POINTS,
  PRICING_OPTIONS,
  SECURITY_POINTS,
  WHY_POINTS,
  WORKFLOW_STEPS,
} from './content';
import type { IconItem } from './content';
import { SanitizedHtml } from '../../components/SanitizedHtml';
import { api } from '../../utils/api';
import type { FaqSummary } from '../../types';

const primaryButtonClass =
  'inline-flex items-center gap-1.5 bg-gray-950 hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-sm text-sm';

/**
 * 공개 홈(로그인 전 `/`, 2026-11-13) — 위드싸인 홈 구성을 따른다: 히어로 → 서비스 소개 → 비교표 → 핵심 기능 →
 * 진행 흐름 → 왜 디지털 서명식인가 → 안전한 관리 → 이용 방식 → 자주 묻는 질문 → 문의 유도.
 * 문구는 content.ts에 모았고, 자주 묻는 질문만 관리자가 등록한 고객용 FAQ를 불러온다(없으면 그 영역을 숨긴다).
 */
export const PublicHome: FC = () => (
  <>
    <section className="bg-gray-50 border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-20 sm:py-28 text-center">
        <p className="text-sm font-bold text-gray-500">협약식·서명식 전자서명 플랫폼</p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-gray-950 leading-tight">
          서명하는 순간을 무대 위로,
          <br />
          싸인스테이지로 시작하세요
        </h1>
        <p className="mt-5 text-base sm:text-lg text-gray-500">
          행사 준비부터 현장 서명, 무대 연출, 결과 문서 보관까지 하나의 플랫폼에서 진행합니다.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/contact" className={primaryButtonClass}>
            <MessageSquare size={16} /> 도입 문의
          </Link>
        </div>
      </div>
    </section>

    <Section title="싸인스테이지란 무엇인가요?" description="여러 서명자가 한자리에 모이는 행사를 위해 만든 현장형 전자서명 서비스입니다.">
      <IconCardGrid items={INTRO_POINTS} />
    </Section>

    <Section
      tone="muted"
      title="종이 서명식과 무엇이 다른가요?"
      description="서명본을 인쇄하고 옮기며 서명하던 과정을 하나의 디지털 서명식으로 바꿉니다."
    >
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-28 px-4 py-3 text-left font-medium">항목</th>
              <th className="px-4 py-3 text-left font-medium">종이 서명식</th>
              <th className="px-4 py-3 text-left font-bold text-gray-950">싸인스테이지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.label} className="align-top">
                <td className="px-4 py-3 font-medium text-gray-950">{row.label}</td>
                <td className="px-4 py-3 text-gray-500">
                  <span className="inline-flex gap-1.5">
                    <X size={14} className="mt-0.5 shrink-0 text-gray-300" />
                    {row.paper}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-950">
                  <span className="inline-flex gap-1.5">
                    <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    {row.signstage}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>

    <Section title="행사에 필요한 기능을 모두 갖췄습니다" description="준비·리허설·현장 진행·결과 관리까지 실제 행사 흐름에 맞춰 만들었습니다.">
      <IconCardGrid items={FEATURES} />
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {FEATURE_CHIPS.map((chip) => (
          <span key={chip} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
            {chip}
          </span>
        ))}
      </div>
    </Section>

    <Section
      id="workflow"
      tone="muted"
      title="간단한 흐름으로 행사를 진행합니다"
      description="평소 쓰던 협약서 그대로, 등록부터 결과 문서까지 다섯 단계면 됩니다."
    >
      <WorkflowTabs />
    </Section>

    <Section title="디지털 서명식, 이렇게 달라집니다" description="서명식은 문서 작업이 아니라 기관의 신뢰를 보여주는 자리입니다.">
      <IconCardGrid items={WHY_POINTS} />
    </Section>

    <Section tone="muted" title="안전하게 관리합니다" description="서명자 접근 분리부터 결과 문서 원본 확인까지 행사 전후를 지킵니다.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECURITY_POINTS.map((item) => (
          <IconCard key={item.title} item={item} horizontal />
        ))}
      </div>
    </Section>

    <Section title="행사에 맞게 이용하세요" description="금액은 서명자·태블릿 수와 현장 지원 범위에 따라 견적으로 안내합니다.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PRICING_OPTIONS.map(({ icon: Icon, title, description, points, recommended }) => (
          <div
            key={title}
            className={`flex flex-col rounded-lg border bg-white p-6 shadow-sm ${recommended ? 'border-gray-950' : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950 text-white">
                <Icon size={18} />
              </div>
              {recommended && <span className="rounded-full bg-gray-950 px-2 py-0.5 text-xs font-bold text-white">추천</span>}
            </div>
            <h3 className="mt-4 text-base font-bold text-gray-950">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-700">
              {points.map((point) => (
                <li key={point} className="flex gap-2">
                  <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                  {point}
                </li>
              ))}
            </ul>
            <Link to="/contact" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-gray-950 hover:underline">
              견적 문의 <ArrowRight size={14} />
            </Link>
          </div>
        ))}
      </div>
    </Section>

    <FaqSection />

    <section className="bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold">다음 행사, 싸인스테이지와 함께 준비하세요</h2>
        <p className="mt-3 text-sm sm:text-base text-gray-400">행사 일정과 규모를 알려주시면 담당자가 진행 방식과 견적을 안내해 드립니다.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-gray-100 text-gray-950 font-bold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <MessageSquare size={16} /> 문의하기
          </Link>
        </div>
      </div>
    </section>
  </>
);

const Section: FC<{ id?: string; tone?: 'muted'; title: string; description?: string; children: ReactNode }> = ({
  id,
  tone,
  title,
  description,
  children,
}) => (
  <section id={id} className={`scroll-mt-16 ${tone === 'muted' ? 'bg-gray-50 border-y border-gray-200' : 'bg-white'}`}>
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-950">{title}</h2>
        {description && <p className="mt-3 text-sm sm:text-base text-gray-500">{description}</p>}
      </div>
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

const IconCard: FC<{ item: IconItem; horizontal?: boolean }> = ({ item: { icon: Icon, title, description }, horizontal }) => (
  <div className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${horizontal ? 'flex gap-4' : ''}`}>
    <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white ${horizontal ? '' : 'mb-3'}`}>
      <Icon size={18} />
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-950">{title}</h3>
      <p className="mt-1.5 text-sm text-gray-500">{description}</p>
    </div>
  </div>
);

const IconCardGrid: FC<{ items: IconItem[] }> = ({ items }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    {items.map((item) => (
      <IconCard key={item.title} item={item} />
    ))}
  </div>
);

/** 진행 흐름 — 위드싸인 워크플로처럼 단계 탭을 누르면 그 단계 설명을 보인다. */
const WorkflowTabs: FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = WORKFLOW_STEPS[activeIndex];
  const ActiveIcon = active.icon;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex overflow-x-auto border-b border-gray-200" role="tablist">
        {WORKFLOW_STEPS.map((step, index) => (
          <button
            key={step.title}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className={`flex-1 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
              index === activeIndex ? 'border-b-2 border-gray-950 text-gray-950' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <span className="mr-1.5 text-xs tabular-nums">{String(index + 1).padStart(2, '0')}</span>
            {step.title}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-10" role="tabpanel">
        <div className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-950">
          <ActiveIcon size={30} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-950">{active.description}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{active.detail}</p>
        </div>
      </div>
    </div>
  );
};

/** 고객용 FAQ(관리자 등록, 공개 API) — 하나도 없거나 불러오지 못하면 영역째 숨긴다. 답변은 HTML 에디터로 쓴 내용이다. */
const FaqSection: FC = () => {
  const [faqs, setFaqs] = useState<FaqSummary[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/public/faqs')
      .then((response) => {
        if (cancelled) return;
        const loaded = response.data as FaqSummary[];
        setFaqs(loaded);
        setOpenId(loaded[0]?.id ?? null);
      })
      .catch(() => {
        // 공개 홈은 FAQ 없이도 보인다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (faqs.length === 0) return null;

  return (
    <Section id="faq" tone="muted" title="자주 묻는 질문">
      <div className="mx-auto max-w-3xl divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-gray-950"
              >
                {faq.question}
                <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && <SanitizedHtml html={faq.answer} className="px-5 pb-4 text-sm leading-relaxed text-gray-500" />}
            </div>
          );
        })}
      </div>
    </Section>
  );
};
