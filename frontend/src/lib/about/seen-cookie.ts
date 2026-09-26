/**
 * 서비스 소개를 본 적이 있는가 — 홈 소개 카드의 기억 (#950).
 *
 * **localStorage 가 아니라 쿠키다.** 홈(`app/(main)/(home)/page.tsx`)은 `readSession()` 때문에
 * 이미 요청마다 서버에서 그린다. 서버가 이 값을 읽으면 카드를 **처음부터** 넣거나 빼고
 * 그린다. localStorage 는 마운트 뒤에야 읽혀서, 카드를 늦게 끼워 넣는 동안 그 아래 배너들이
 * 한 번 밀린다.
 *
 * 토큰이 아니라 화면 설정이다 — "토큰은 localStorage 금지" 규칙과 상관이 없고, `HttpOnly` 도
 * 필요 없다. 브라우저가 직접 쓰는 값이라 오히려 `HttpOnly` 이면 안 된다.
 *
 * **두 곳이 쓴다.** 홈 카드의 × 와 `/about` 방문(`MarkAboutSeen`)이다 — 소개를 한 번 연
 * 사람에게 소개로 가는 카드를 다시 보일 이유가 없다.
 */
export const ABOUT_SEEN_COOKIE = 'hd_about_seen'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/** `document.cookie` 에 넣을 한 줄. `Path=/` 가 없으면 `/about` 에서 쓴 값이 홈에 닿지 않는다 */
export function aboutSeenCookie(): string {
  return `${ABOUT_SEEN_COOKIE}=1; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`
}

/** 서버가 읽은 쿠키 값으로 판단한다. `'1'` 만 본 것으로 친다 */
export function hasSeenAbout(value: string | undefined): boolean {
  return value === '1'
}

/** 브라우저 전용 — 이벤트 핸들러 · effect 안에서만 부른다 */
export function markAboutSeen(): void {
  document.cookie = aboutSeenCookie()
}

/**
 * `document.cookie` 같은 `a=1; b=2` 문자열에서 이 쿠키를 봤는가 (#950).
 *
 * **왜 브라우저도 읽나.** 서버가 정한 `showAboutIntro` 는 그 요청의 RSC 페이로드에 박히고,
 * 뒤로/앞으로 가기는 그 페이로드를 캐시에서 다시 쓴다. × 로 닫거나 `/about` 을 연 뒤 뒤로
 * 오면 서버는 묻지 않은 채 카드가 다시 선다 — 그 자리만 브라우저가 쿠키로 한 번 더 막는다.
 */
export function hasSeenAboutIn(cookieString: string): boolean {
  return cookieString.split(';').some((pair) => pair.trim() === `${ABOUT_SEEN_COOKIE}=1`)
}
