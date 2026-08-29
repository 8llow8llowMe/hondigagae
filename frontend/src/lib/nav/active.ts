/**
 * 내비게이션 활성 판정 — 전역nav-세부명세 D7 #11·#12.
 *
 * **루트(`/`)는 정확히 일치할 때만 활성이다.** `startsWith` 로 하면 모든 경로가 `/` 로
 * 시작하므로 **모든 화면에서 홈이 활성**이 된다. 명세가 이것을 핵심 케이스로 지목했다.
 *
 * 나머지는 하위 경로까지 활성이다 — `/places/123` 에서 "장소 찾기" 가 켜져 있어야
 * 사용자가 자기 위치를 안다.
 */
export function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'

  // `/pets` 가 `/petsomething` 에 걸리지 않게 경계를 본다
  return pathname === href || pathname.startsWith(`${href}/`)
}
