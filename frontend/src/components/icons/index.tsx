import type { SVGProps } from 'react'

/**
 * 아이콘 세트 — **아트보드(`혼디가개 홈·내비게이션.dc.html`)의 path 를 그대로 옮긴다.**
 *
 * 선(line) 스타일, 굵기 1.5, `currentColor` 사용 — 색은 부모의 `text-*` 가 정한다.
 * 장식이므로 `aria-hidden`. 의미가 필요하면 부모 버튼에 `aria-label` 을 준다.
 */
/**
 * `size` 를 열거로 묶어 임의 크기를 막는다 — 아이콘이 화면마다 조금씩 다른 크기로
 * 흩어지는 것을 타입이 잡는다. **28 은 마이페이지 프로필 아바타(64 원형) 전용**이다
 * (아트보드 `혼디가개 마이페이지·내 반려견` 01).
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: 14 | 16 | 18 | 20 | 22 | 24 | 28 }

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
      <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />
    </Svg>
  )
}

/** 장소 탭은 돋보기다 — 지도 핀이 아니다 (아트보드) */
export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Svg>
  )
}

export function PlanIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
    </Svg>
  )
}

export function MyPageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

/** 병원 · 약국. 왕진 가방이다 */
export function EmergencyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6.5" width="17" height="14" rx="2" />
      <path d="M9 6.5V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M12 10.5v6M9 13.5h6" />
    </Svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}

/** 더 안전한 시간대 */
export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  )
}

/** 썸네일 폴백 */
export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M3.5 15l4.5-4 4 3.5 3-2.5 5 4.5" />
      <circle cx="9" cy="9.5" r="1.2" />
    </Svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </Svg>
  )
}

export function RainIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 15a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.5 1.6A3.6 3.6 0 0 1 17 15z" />
      <path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2" />
    </Svg>
  )
}

export function CloudIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 18a4.5 4.5 0 0 1 .4-9 6 6 0 0 1 11.4 1.8A3.9 3.9 0 0 1 17.5 18z" />
    </Svg>
  )
}

/**
 * 체크 — 선택된 체크박스 안에 들어간다.
 *
 * 아트보드는 여기서만 굵기 2 를 쓴다. 20px 표시기 안의 14px 마크라 1.5 로는 형태가 뭉갠다.
 * 사용처가 `strokeWidth={2}` 를 넘긴다 (`Svg` 의 기본값을 바꾸지 않는다).
 */
export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  )
}

/**
 * 전화 — 긴급 시설 행의 전화 버튼 (아트보드 `긴급 시설` 01).
 *
 * 수화기를 기울인 고전형이다. 스트로크 1.5 로 52px 버튼 안 24px 마크.
 */
export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.5 5.7 2 2 0 016.5 3.5z" />
    </Svg>
  )
}

/** 필터 "더보기" — 슬라이더 3단 (아트보드 `01 목록 — 모바일`) */
export function SlidersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </Svg>
  )
}

/** 더하기 — 일정 목록 헤더의 새 일정 버튼 (아트보드 `여행 일정` 04) */
export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

/**
 * 더보기(세로 점 셋) — 일정 상세의 관리 메뉴 트리거 (아트보드 `여행 일정` 01·02).
 *
 * 점은 선이 아니라 면이라 `Svg` 의 stroke 규칙으로는 그려지지 않는다.
 * `fill="currentColor"` 를 명시하고 stroke 를 끈다.
 */
export function MoreIcon(props: IconProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </Svg>
  )
}
