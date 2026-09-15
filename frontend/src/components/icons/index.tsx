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

/** 사진 뷰어의 이전 사진. `ChevronRightIcon` 을 회전시키지 않는다 — 회전은 애니메이션의 몫이다 */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 6l-6 6 6 6" />
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

/**
 * 길찾기 — 시설 행의 전화 옆 버튼 (#537).
 *
 * **`PinIcon` 을 쓰지 않는다.** 핀은 "여기 있다"(위치)이고 이 버튼은 "여기로 간다"(이동)다 —
 * 같은 행에서 주소 줄이 이미 위치를 말하므로 핀을 또 쓰면 두 개가 같은 것을 가리킨다.
 * 방향을 가진 화살촉이라 52px 버튼 안에서 전화 수화기와 실루엣이 겹치지 않는다.
 */
export function DirectionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 11 22 2l-9 19-2-8z" />
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

/**
 * 저장(즐겨찾기) — 아트보드 `혼디가개 장소 상세` 01·03 하단 바의 북마크.
 *
 * **채움으로 저장 여부를 말한다.** 저장된 상태는 `fill="currentColor"` 를 넘겨 안을 채운다 —
 * 아트보드가 그렇게 그렸고(`fill="#15181D"`), 아이콘 모양을 바꾸지 않아 자리가 흔들리지 않는다.
 */
export function BookmarkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4.5h12v15l-6-4-6 4z" />
    </Svg>
  )
}

/**
 * 지도 — 목록↔지도 세그먼트의 모바일(아이콘) 변형에 쓴다.
 * 장소 탭의 돋보기와 구분된다: 저쪽은 "찾기", 이쪽은 "보기 방식" 이다.
 */
export function MapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
      <path d="M9 4.5v12.7" />
      <path d="M15 6.8v12.7" />
    </Svg>
  )
}

/** 목록 — 지도에서 목록으로 되돌리는 쪽 */
export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6.5h12" />
      <path d="M8 12h12" />
      <path d="M8 17.5h12" />
      <path d="M4 6.5h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17.5h.01" />
    </Svg>
  )
}

/** 위치 핀 — 지도 마커·현재 위치 버튼 */
export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </Svg>
  )
}

/** 현재 위치로 — 조준 과녁 */
export function CrosshairIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </Svg>
  )
}

/** 닫기 — 지도 선택 카드 */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  )
}

/**
 * 물음표 원 — `InfoTip` 트리거 (#313).
 *
 * **원을 아이콘 안에 그린다.** 버튼 쪽 `rounded-full` 배경으로 대신하면 44px 터치 영역과
 * 원의 크기가 같아져(§7) 화면에서 22px 짜리 회색 동그라미가 된다 — 원은 16px 로 두고
 * 터치 영역은 그 바깥 여백이 맡는다.
 */
export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 2.9 2.5v1.4" />
      <path d="M12.5 16.4h.01" />
    </Svg>
  )
}

/**
 * 구름많음 — 해가 구름 뒤에 있다. 서버 `SkyState.MOSTLY_CLOUDY` (#314).
 *
 * **`OVERCAST`(흐림)와 갈라 둔다.** 서버가 둘을 다른 낱말로 부르는데 같은 그림을 주면
 * 아이콘이 낱말보다 정보를 덜 담게 된다 — 그러면 낱말을 대체할 자격이 없다 (DESIGN.md §9-1).
 */
export function PartlyCloudyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M9 2.6v1.4M4.4 8H3M12.2 4.1l1-1M4.8 4.1l-1-1" />
      <path d="M8.5 19a3.8 3.8 0 0 1 .4-7.6 5.2 5.2 0 0 1 9.8 1.5A3.4 3.4 0 0 1 18 19z" />
    </Svg>
  )
}

/** 눈 — 서버 `SNOW` · `SNOW_FLURRY` (#314) */
export function SnowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 15a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.5 1.6A3.6 3.6 0 0 1 17 15z" />
      <path d="M8.5 19h.01M12 20.5h.01M15.5 19h.01" />
    </Svg>
  )
}

/**
 * 비와 눈이 섞임 — 서버 `RAIN_SNOW` · `DRIZZLE_SNOW` (#314).
 *
 * **비나 눈 하나로 뭉개지 않는다.** 서버가 `비/눈` 이라고 부르는 것을 눈으로만 그리면
 * 그림이 서버보다 덜 말한다.
 */
export function SleetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 15a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.5 1.6A3.6 3.6 0 0 1 17 15z" />
      <path d="M9 18.5l-1 2" />
      <path d="M12.5 20h.01M15.5 18.5h.01" />
    </Svg>
  )
}

/**
 * 눈 — 비밀번호 표시 토글의 "지금 가려져 있다" 상태 (누르면 보인다).
 *
 * **아트보드에 없는 아이콘이다.** 로그인 화면이 `표시` / `숨기기` 텍스트 버튼을 입력란
 * **옆에** 세우고 있었는데, 그 버튼이 44px 폭을 가져가는 만큼 입력란이 짧아졌다. 아이콘을
 * 입력란 **안**으로 넣으면 입력란이 열 끝까지 선다. 선 굵기·`currentColor` 규약은 위와 같다.
 */
export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

/**
 * 눈 + 사선 — "지금 보이고 있다" 상태 (누르면 가려진다).
 *
 * **눈을 그대로 두고 선만 긋는다.** 두 상태가 전혀 다른 그림이면 토글이라는 것이 읽히지
 * 않는다 — 바뀌는 것은 사선 하나다.
 */
export function EyeOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 4" />
      <path d="M6.3 7.9A17.4 17.4 0 0 0 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 4-.85" />
      <path d="M10 10a3 3 0 0 0 4.1 4.1" />
      <path d="M4 4l16 16" />
    </Svg>
  )
}
