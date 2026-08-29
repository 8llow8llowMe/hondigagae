import type { SVGProps } from 'react'

/**
 * 아이콘 세트 — DESIGN.md §9.
 *
 * 선(line) 스타일, 굵기 **1.5px**, 24px 기본 / 20px 조밀 / 16px 인라인.
 * `currentColor` 를 쓰므로 색은 부모의 `text-*` 가 정한다 — 아이콘에 색을 박지 않는다.
 *
 * **장식 아이콘은 `aria-hidden` 이다.** 의미를 담아야 하면 부모 버튼에 `aria-label` 을 준다
 * (icon-only 버튼은 `Button` 이 타입으로 강제한다).
 *
 * 반려견 아이콘을 과하게 귀엽게 그리지 않는다 (제품 톤 §1).
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: 16 | 20 | 24 }

function Svg({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </Svg>
  )
}

export function PlaceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  )
}

export function PlanIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
    </Svg>
  )
}

export function MyPageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Svg>
  )
}

/** 긴급 시설. **아이콘만 danger 색이고 배경은 채우지 않는다** (전역nav-세부명세 D4-4) */
export function EmergencyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-7.5-4.6-7.5-10.2A5.3 5.3 0 0 1 12 7a5.3 5.3 0 0 1 7.5 3.8C19.5 16.4 12 21 12 21Z" />
      <path d="M12 10.5v4M10 12.5h4" />
    </Svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Svg>
  )
}
