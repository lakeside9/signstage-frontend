import type { AnchorHTMLAttributes, ButtonHTMLAttributes, FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-outline';
export type ButtonSize = 'md' | 'sm';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-gray-950 text-white hover:bg-gray-800',
  secondary: 'border border-gray-200 text-gray-600 hover:border-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  'danger-outline': 'border border-red-200 text-red-700 hover:bg-red-50',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-sm',
  sm: 'px-3 py-1.5 text-xs',
};

const BASE_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
}

type ButtonAsButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { to?: undefined };

type ButtonAsLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & { to: string };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const isLinkProps = (props: ButtonProps): props is ButtonAsLinkProps => props.to !== undefined;

/**
 * 플랫폼 관리자 화면 전체가 공유하는 버튼 — signstage-docs
 * frontend/detail-form-screen-convention.md 8장("패턴 A 입력 스타일 통일 여부")에서 미결정으로
 * 남아있던 항목을 이 컴포넌트 도입으로 해소한다(2026-09-09). 이전엔 파일마다 버튼 클래스를
 * 손으로 새로 써서 크기(px-4 py-2 / px-3 py-1.5 / px-3 py-1 / px-4 py-1.5 등)와 위험(빨강) 버튼
 * 스타일(채움/빨강 테두리/회색 테두리+빨강 글자 3종)이 화면마다 표류해 있었다.
 *
 * - **크기 2단계로 고정**: `md`(페이지 레벨 주 액션) / `sm`(표 안 인라인 액션). `lg`를 따로 두지
 *   않는다 — 등록 전용 페이지(패턴 A)의 전체폭 제출 버튼도 `size="md"` + `className="w-full"`로
 *   표현한다.
 * - **색상 4종으로 고정**: `primary`(기본, 검정 채움) / `secondary`(회색 테두리) / `danger`(빨강
 *   채움) / `danger-outline`(빨강 테두리+글자). "회색 테두리+빨강 글자" 변종은 없앴다.
 * - `to`를 주면 `react-router-dom`의 `Link`로, 안 주면 `<button type="button">`으로 렌더링한다
 *   (목록 화면 상단의 "추가" 같은 페이지 이동 액션도 같은 컴포넌트로 통일하기 위함). `type="submit"`이
 *   필요하면 `type` prop으로 명시적으로 덮어쓴다.
 */
export const Button: FC<ButtonProps> = (props) => {
  const { variant = 'primary', size = 'md', className = '', children, ...rest } = props;
  const classes = [BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className].filter(Boolean).join(' ');

  if (isLinkProps(props)) {
    const { to, ...linkRest } = rest as Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> & {
      to: string;
    };
    return (
      <Link to={to} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const buttonRest = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;
  return (
    <button {...buttonRest} type={buttonRest.type ?? 'button'} className={classes}>
      {children}
    </button>
  );
};
