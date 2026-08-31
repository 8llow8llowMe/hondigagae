/**
 * 소셜 로그인 제공자 식별자.
 *
 * 백엔드 `OAuthProvider` enum(KAKAO / NAVER)의 복제본이고, **경로에는 소문자를 쓴다**
 * — `WebConfig` 가 `fromName` 컨버터를 등록해 대소문자를 가리지 않지만, Swagger 예시와
 * 제공자 문서가 모두 소문자라 한쪽으로 고정한다.
 *
 * `src/lib/` 에 두는 이유는 `EMAIL_PATTERN` 과 같다: 로그인 화면의 소셜 버튼과 콜백
 * 화면이 같은 목록·같은 표시 이름을 써야 한다.
 */
export const OAUTH_PROVIDERS = ['kakao', 'naver'] as const

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]

/**
 * 표시 이름. 백엔드 `OAuthProvider.description` 과 같은 값이라 `AUTH_008` 문구
 * ("이미 카카오(으)로 가입된 계정입니다")와 화면의 버튼 라벨이 같은 말을 쓴다.
 *
 * **객체 리터럴이 아니라 `Map` 이다.** 조회 키가 URL 경로 세그먼트(`/oauth/[provider]/…`)라
 * 사용자가 그대로 조작할 수 있다. 객체면 `?provider=toString` 이 `undefined` 가 아니라
 * **상속된 함수**를 돌려줘 React 가 "Objects are not valid as a React child" 로 터진다
 * — `reauth-notice.tsx` 가 같은 이유로 Map 을 쓴다.
 */
const PROVIDER_NAMES = new Map<string, string>([
  ['kakao', '카카오'],
  ['naver', '네이버'],
])

export function isOAuthProvider(raw: string): raw is OAuthProviderId {
  return PROVIDER_NAMES.has(raw)
}

/** 모르는 값이면 `null`. 호출부가 "제공자를 특정할 수 없는 화면" 으로 갈라야 한다 */
export function oauthProviderName(raw: string): string | null {
  return PROVIDER_NAMES.get(raw) ?? null
}
