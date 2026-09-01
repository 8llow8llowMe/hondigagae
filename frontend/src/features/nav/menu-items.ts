/**
 * 메뉴 구성 — 전역nav-세부명세 D4-1.
 *
 * **데스크톱과 모바일이 다르다.** 합치지 않는 이유는 구성이 달라서다 (D2).
 *  - AI 일정 생성: 데스크톱에만. 진입 빈도가 낮고 일정 화면 안에서 시작하는 것이 맥락에 맞다
 *  - 내 반려견: 데스크톱 메뉴 / 모바일은 "내 정보" 안
 *  - 긴급 시설: 어느 쪽 메뉴에도 없다. 데스크톱 헤더 아이콘 + 홈의 바가 진입점이다
 *    (탭에 두면 평상시에 계속 붉은 신호가 보인다 — D4-4)
 */
export type NavItem = {
  href: string
  label: string
  /** 로그인이 필요한 목적지. 미로그인 처리가 플랫폼마다 다르다 (D4-2) */
  protected: boolean
  /** AI 생성 표시 — accent 는 이 용도 전용이다 (DESIGN.md §2-5) */
  ai?: boolean
}

/**
 * 데스크톱 헤더. 홈은 로고가 대신하므로 넣지 않는다.
 *
 * **셋뿐이다 — 전부 "할 일" 이다.** 내 반려견·마이페이지·로그아웃은 "내 설정" 이라
 * 우측 아바타 팝오버가 맡는다 (`ACCOUNT_MENU_ITEMS`). 같은 줄에 섞으면 nav 의 기준이
 * 흐려져 항목이 계속 늘어난다 — 아트보드 03-B 의 주석이 이것을 명시한다.
 *
 * **미로그인에도 셋 다 그린다** (이슈 #112 이후 #116). `protected` 는 숨김 여부가 아니라
 * **로그인으로 우회시킬지**의 표시다 — 아래 `toLoginHref` 를 보라.
 */
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { href: '/places', label: '장소 찾기', protected: false },
  { href: '/plans', label: '여행 일정', protected: true },
  { href: '/ai-plans/new', label: 'AI 일정 생성', protected: true, ai: true },
]

/**
 * 우측 아바타 팝오버 — 아트보드 03-B.
 * 모바일의 "내 정보 탭 안" 과 같은 구조다. 두 폭이 다른 IA 를 갖지 않는다.
 *
 * **`저장한 장소` 가 여기 있다** (#127). 아트보드 `혼디가개 저장한 장소` 가 진입점을
 * "모바일: 내 정보 탭 · 데스크톱: 아바타 팝오버" 로 못박았다 — 탭바는 4개 고정이라
 * (D4-1) 늘리지 않고, 모바일은 마이페이지 안의 행이 맡는다 (`MyFavoritesRow`).
 *
 * 순서는 **내 것부터 설정 순**이다: 반려견 · 저장한 장소 → 마이페이지.
 */
export const ACCOUNT_MENU_ITEMS = [
  { href: '/pets', label: '내 반려견' },
  { href: '/favorites', label: '저장한 장소' },
  { href: '/mypage', label: '마이페이지' },
] as const

/**
 * 모바일 탭바. **4개로 고정한다** — 5개가 되면 375px 에서 라벨이 줄바꿈된다 (D4-1).
 * 순서를 바꾸지 않는다. 탭은 위치가 근육기억이다.
 */
export const MOBILE_TAB_ITEMS: NavItem[] = [
  { href: '/', label: '홈', protected: false },
  { href: '/places', label: '장소', protected: false },
  { href: '/plans', label: '일정', protected: true },
  { href: '/mypage', label: '내 정보', protected: true },
]

/**
 * 미로그인일 때 보호 경로로 보낼 링크. **데스크톱·모바일이 같은 처리를 쓴다** (#116).
 *
 * 원래는 데스크톱만 항목을 숨겼다 (아트보드 `03 전역 nav · A — 미로그인 (보호 메뉴 3개 숨김)`).
 * **그것을 의도적으로 벗어났다**: 숨기면 미로그인 데스크톱 헤더에 `장소 찾기` 하나만 남고,
 * `/ai-plans/new` 로 가는 링크가 저장소 전체에서 그 하나와 `/plans` 안의 시트뿐이라
 * **처음 방문한 사람이 AI 여행 설계의 존재를 알 방법이 없어진다.** 모바일 탭에는 AI 항목이
 * 애초에 없고 홈에도 링크가 없다 — 근거는 명세 D4-2.
 */
export function toLoginHref(href: string): string {
  return `/login?returnTo=${encodeURIComponent(href)}`
}
