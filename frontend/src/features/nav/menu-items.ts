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

/** 데스크톱 헤더. 홈은 로고가 대신하므로 넣지 않는다 */
export const DESKTOP_NAV_ITEMS: NavItem[] = [
  { href: '/places', label: '장소 찾기', protected: false },
  { href: '/plans', label: '여행 일정', protected: true },
  { href: '/ai-plans/new', label: 'AI 일정 생성', protected: true, ai: true },
  { href: '/pets', label: '내 반려견', protected: true },
]

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
 * 미로그인일 때 보호 경로로 보낼 링크.
 *
 * **데스크톱은 항목을 숨기고 모바일은 유지한다** (D4-2). 이 비대칭은 의도적이다 —
 * 헤더는 가로 목록이라 항목이 줄어도 나머지 위치가 크게 안 변하지만, 탭은 위치가
 * 근육기억이라 숨기면 남은 탭이 이동해 오조작이 늘어난다.
 */
export function toLoginHref(href: string): string {
  return `/login?returnTo=${encodeURIComponent(href)}`
}

/** 데스크톱에서 실제로 그릴 항목 */
export function visibleDesktopItems(authed: boolean): NavItem[] {
  return authed ? DESKTOP_NAV_ITEMS : DESKTOP_NAV_ITEMS.filter((item) => !item.protected)
}
