/**
 * BFF 가 직접 심는 쿠키의 공통 옵션.
 *
 * 세션(`./session.ts`)과 소셜 state(`./oauth-state.ts`)가 같은 값을 써야 한다 —
 * 한쪽만 `secure` 가 빠지거나 `sameSite` 가 어긋나면 그 쿠키만 특정 환경에서 조용히
 * 사라진다. 값이 하나뿐이라 그런 어긋남이 생기지 않는다.
 *
 * **`sameSite: 'lax'` 다.** 게이트웨이의 원본 쿠키는 `Strict` 인데 여기서 낮춘 이유는
 * **세션 쿠키가 이미 `Lax` 이기 때문**이다. 소셜 콜백 화면은 제공자 도메인에서 오는
 * 크로스사이트 최상위 이동으로 진입하고 그 진입이 세션을 읽어야 하므로, `Strict` 면
 * 로그인 상태가 끊긴다.
 *
 * state 쿠키만 `Strict` 로 올릴 수는 있다 — **정작 이 쿠키가 필요한 시점은 콜백 화면
 * 진입이 아니라 그 화면이 쏘는 동일 사이트 XHR**(`/api/bff/auth/{provider}/login`)이고,
 * `Strict` 쿠키도 동일 사이트 요청에는 실린다. 그래도 한 값으로 둔다. 쿠키마다 정책이
 * 갈리면 다음 사람이 어느 쪽이 의도이고 어느 쪽이 실수인지 읽지 못한다.
 *
 * **`Lax` 라고 이 쿠키의 방어가 약해지지 않는다.** state 쿠키가 지키는 것은 "요청한
 * 브라우저가 맞는가" 이고 그 보증은 `SameSite` 가 아니라 **쿠키를 가졌는지**에서 나온다.
 * 공격자가 피해자를 `/api/bff/auth/{provider}/login?state=<공격자 state>` 로 이동시켜
 * 이 쿠키가 실려 나가도, 피해자 쿠키에는 공격자의 state 가 없어 대조에서 걸린다 (BE #681).
 *
 * 쿠키 이름이 아니라 옵션만 담는다 (`./cookie-names.ts` 와 나눈 이유는 임포트 표면이다).
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const
