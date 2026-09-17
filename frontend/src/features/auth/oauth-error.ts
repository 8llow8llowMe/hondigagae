import { isSignupConsentCode } from '@/lib/auth/signup-consent'

/**
 * 소셜 로그인 실패의 **다음 행동**을 정한다.
 *
 * **문구는 여기서 만들지 않는다.** 여덟 개 오류 코드의 `resultMessage` 가 이미 사유와
 * 행동을 안내하고(`AuthErrorCode` 실측), `AUTH_008` 은 어느 소셜로 가입됐는지까지
 * 말해 준다. `errorCode` 로 가르는 것은 **버튼이 무엇을 말해야 하는가**뿐이다 (정본 D1).
 *
 * 목적지는 셋 다 `/login` 이다. **콜백에서 재시도하지 않는다** — `code` 는 1회용이고
 * `state` 는 서버가 조회와 동시에 지운다(Redis GETDEL). 이 화면에 남아 다시 부르면
 * 무조건 `AUTH_010` 이다.
 */
export type OAuthNextAction =
  /** 제공자 동의 화면에서 항목을 켜고 다시 시도해야 한다 */
  | 'consent'
  /**
   * **우리 쪽** 가입 동의가 비었다 — 회원가입 화면에서 동의한 뒤 다시 시도해야 한다 (#688).
   *
   * `consent` 와 갈라 두는 이유는 고칠 자리가 다르기 때문이다: 저쪽은 제공자의 동의
   * 화면이고, 이쪽은 우리 회원가입 화면의 체크박스다. 로그인 화면의 소셜 버튼은 동의를
   * 싣지 않으므로(기존 회원 전용) 신규 사용자가 거기로 들어오면 반드시 여기로 온다.
   */
  | 'signup-consent'
  /** 이미 다른 소셜로 가입된 계정 — 그 소셜로 로그인해야 한다 */
  | 'signin'
  /** 처음부터 다시 (state 만료·인증 실패·제공자 장애·일시 오류) */
  | 'retry'

/** 제공자 쪽에서 조치가 필요한 코드 */
const CONSENT_CODES = new Set([
  // 이메일 제공 미동의
  'AUTH_009',
  // 프로필(닉네임) 제공 미동의
  'AUTH_011',
  // 제공자에서 이메일 미인증
  'AUTH_012',
])

/**
 * `resultCode` 를 다음 행동으로 바꾼다. 모르는 코드·`null` 은 `'retry'` 다 —
 * **새 오류 코드가 늘어도 화면이 막다른 곳이 되지 않아야 한다.**
 *
 * `Set` 을 쓰는 이유는 `oauth-provider.ts` 의 `Map` 과 같다: 조회 키가 서버 응답에서
 * 온 문자열이라 객체 리터럴이면 상속 키(`toString`)가 참을 돌려준다.
 */
export function oauthNextAction(resultCode: string | null): OAuthNextAction {
  if (resultCode === null) return 'retry'
  if (CONSENT_CODES.has(resultCode)) return 'consent'
  // MEMBER_010(문서 동의 누락) / MEMBER_011(만 14세 미확인) — 판정은 한 곳에 둔다
  if (isSignupConsentCode(resultCode)) return 'signup-consent'
  // 이미 다른 소셜로 가입된 계정 — 같은 소셜로 다시 눌러도 결과가 같다
  if (resultCode === 'AUTH_008') return 'signin'
  return 'retry'
}
