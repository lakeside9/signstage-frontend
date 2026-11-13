import type { FC } from 'react';
import {
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  FlaskConical,
  Handshake,
  LayoutGrid,
  MonitorPlay,
  PenLine,
  QrCode,
  ShieldCheck,
  Sparkles,
  Tablet,
  Users,
} from 'lucide-react';

/**
 * 공개 화면 문구(2026-11-13 초안). 실제 기능만 적고, 검증되지 않은 수치(누적 건수 등)나 법적 효력 단정 표현은 넣지 않았다 —
 * 수치·인증·법률 문구는 사업 담당 확인 뒤 채운다.
 */

export interface IconItem {
  icon: FC<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

/** 홈 "싸인스테이지란?" 세 가지 */
export const INTRO_POINTS: IconItem[] = [
  {
    icon: Handshake,
    title: '행사 현장을 위한 전자서명',
    description: '협약식·조인식·서명식처럼 여러 서명자가 한자리에 모이는 행사를 위해 만든 서비스입니다.',
  },
  {
    icon: MonitorPlay,
    title: '서명 장면을 무대 화면으로',
    description: '서명하는 순간이 행사장 스크린에 실시간으로 펼쳐지고, 서명 완료 효과로 행사를 마무리합니다.',
  },
  {
    icon: FileCheck2,
    title: '서명 결과는 바로 문서로',
    description: '서명이 끝나면 결과 문서가 만들어지고, 문서 검증으로 원본 여부를 언제든 확인할 수 있습니다.',
  },
];

/** 홈 비교표 — 종이 서명식과 싸인스테이지 */
export const COMPARISON_ROWS: Array<{ label: string; paper: string; signstage: string }> = [
  { label: '사전 준비', paper: '서명본 인쇄·제본, 서명 순서와 자리 수작업 확인', signstage: '문서 업로드 후 서명란·서명자 배정을 화면에서 설정' },
  { label: '리허설', paper: '실물 서명본으로 동선만 맞춰 봄', signstage: '테스트·리허설 행사로 실제와 같은 흐름을 미리 진행' },
  { label: '현장 진행', paper: '서명본을 서명자 사이로 옮기며 서명', signstage: '서명자별 태블릿·QR 포털에서 동시에 서명' },
  { label: '무대 연출', paper: '카메라 중계에 의존', signstage: '서명 화면과 완료 효과를 프로젝터에 실시간 전시' },
  { label: '결과 보관', paper: '원본 분실·훼손 위험, 사본 배포에 시간 소요', signstage: '결과 문서 자동 생성·보관, 문서 검증 제공' },
];

/** 핵심 기능 */
export const FEATURES: IconItem[] = [
  {
    icon: Tablet,
    title: '태블릿 현장 서명',
    description: '서명자마다 배정된 태블릿에서 자기 서명란만 보고 서명합니다.',
  },
  {
    icon: QrCode,
    title: 'QR 서명자 포털',
    description: 'QR코드로 서명자 전용 화면에 바로 들어가 별도 설치 없이 서명합니다.',
  },
  {
    icon: MonitorPlay,
    title: '프로젝터 실시간 전시',
    description: '진행 상황과 서명 장면을 행사장 화면에 실시간으로 보여줍니다.',
  },
  {
    icon: Sparkles,
    title: '서명 완료 연출 효과',
    description: '행사 성격에 맞는 완료 효과를 골라 서명 순간을 무대의 하이라이트로 만듭니다.',
  },
  {
    icon: FlaskConical,
    title: '테스트·리허설 행사',
    description: '본 행사와 같은 설정으로 미리 진행해 보고, 서명은 초기화해 다시 연습합니다.',
  },
  {
    icon: FileSearch,
    title: '결과 문서 검증',
    description: '받은 결과 문서가 싸인스테이지에서 만든 원본과 같은지 확인합니다.',
  },
];

/** 핵심 기능 아래 작은 칩 */
export const FEATURE_CHIPS = ['조직·멤버 관리', '메뉴·기능 권한', '서명란 배정 확인', '진행 상황 실시간 확인', '현장 지원 파트너', '행사 이력 관리'];

/** 진행 흐름 단계 */
export const WORKFLOW_STEPS: Array<IconItem & { detail: string }> = [
  {
    icon: ClipboardCheck,
    title: '행사 등록',
    description: '행사 일정과 장소, 서명자를 등록합니다.',
    detail: '행사마다 일정·장소·서명자 명단을 등록하고, 필요한 태블릿 수와 현장 지원 여부를 정합니다.',
  },
  {
    icon: LayoutGrid,
    title: '문서·서명란 설정',
    description: '서명할 문서를 올리고 서명란을 배정합니다.',
    detail: '평소 쓰던 협약서 문서를 그대로 올리고, 서명란마다 서명자를 배정합니다. 배정 확인 기능으로 빠진 서명란을 미리 찾습니다.',
  },
  {
    icon: FlaskConical,
    title: '테스트·리허설',
    description: '본 행사 전에 같은 흐름으로 미리 진행합니다.',
    detail: '테스트와 리허설 행사에서 태블릿·프로젝터 연결과 서명 순서를 점검하고, 서명은 초기화해 여러 번 연습할 수 있습니다.',
  },
  {
    icon: PenLine,
    title: '본 행사 서명',
    description: '서명자가 동시에 서명하고 무대 화면에 전시합니다.',
    detail: '진행자가 행사를 시작하면 서명자가 태블릿이나 QR 포털에서 서명하고, 서명 장면과 완료 효과가 프로젝터에 실시간으로 나옵니다.',
  },
  {
    icon: FileCheck2,
    title: '결과 문서 보관',
    description: '결과 문서를 내려받고 검증합니다.',
    detail: '서명이 끝나면 결과 문서가 만들어져 보관되고, 참석 기관에 배포한 뒤에도 문서 검증으로 원본 여부를 확인할 수 있습니다.',
  },
];

/** 홈 "왜 디지털 서명식인가" */
export const WHY_POINTS: IconItem[] = [
  { icon: Sparkles, title: '더 인상적으로', description: '서명 순간이 무대 화면에 펼쳐져 참석자 모두가 함께 지켜봅니다.' },
  { icon: ClipboardCheck, title: '더 정확하게', description: '서명란 배정과 리허설로 현장에서 빠지거나 뒤바뀌는 서명을 막습니다.' },
  { icon: ShieldCheck, title: '더 안전하게', description: '결과 문서를 안전하게 보관하고, 배포한 문서의 원본 여부를 검증합니다.' },
];

/** 이용 요금 — 금액은 행사 규모에 따라 견적으로 안내한다. */
export const PRICING_OPTIONS: Array<IconItem & { points: string[]; recommended?: boolean }> = [
  {
    icon: PenLine,
    title: '행사 단위 이용',
    description: '한두 번의 행사를 위해 필요한 만큼만 이용합니다.',
    points: ['행사 1회 단위 이용', '서명자·태블릿 수에 맞춘 구성', '테스트·리허설 행사 포함'],
  },
  {
    icon: Building2,
    title: '기관 구독',
    description: '행사가 잦은 기관을 위한 정기 이용입니다.',
    points: ['기간 내 여러 행사 진행', '조직·멤버·권한 관리', '행사별 추가 구성 선택'],
    recommended: true,
  },
  {
    icon: Users,
    title: '현장 지원',
    description: '장비 설치부터 진행 보조까지 현장을 함께 운영합니다.',
    points: ['태블릿·프로젝터 장비 지원', '현장 운영 인력 지원', '리허설 동행'],
  },
];

/** 효력·보안 */
export const SECURITY_POINTS: IconItem[] = [
  {
    icon: PenLine,
    title: '서명자별 접근 분리',
    description: '서명자는 자기에게 배정된 서명란만 보고 서명합니다. 서명자 포털 주소는 서명자마다 따로 발급됩니다.',
  },
  {
    icon: ShieldCheck,
    title: '계정·권한 관리',
    description: '조직 멤버의 메뉴·기능 권한을 나눠 행사 설정과 진행을 맡은 사람만 다루게 합니다.',
  },
  {
    icon: FileSearch,
    title: '결과 문서 원본 확인',
    description: '배포된 결과 문서를 올리면 싸인스테이지가 만든 원본과 같은지 확인합니다.',
  },
  {
    icon: ClipboardCheck,
    title: '진행 기록',
    description: '행사 시작·서명·완료 같은 진행 기록을 남겨 행사 뒤에도 확인할 수 있습니다.',
  },
];
