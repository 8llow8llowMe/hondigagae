/**
 * 소셜 로그인 제공자 표시명.
 *
 * **FE 매핑이 불가피한 예외다.** enum metadata 규칙("FE 한국어 매핑 테이블 금지",
 * api-integration-guide.md §6)은 서버가 `name` 을 주는 metadata 객체를 대상으로 한다.
 * `MemberMyInfoResponse.provider` 는 표시명 없는 raw string(`"KAKAO"`)이라 매핑 외
 * 방법이 없다 — 장소 상세의 `cpyrhtDivCd` 와 같은 처리다 (장소상세-세부명세 D8).
 *
 * **모르는 값 폴백이 필수다.** 백엔드에 제공자가 늘어나면(네이버 등) 이 표가 먼저
 * 낡는다. 그때 화면이 빈칸을 내거나 `"NAVER"` 를 그대로 보여주는 것보다,
 * 원문을 그대로 쓰되 문장이 성립하게 두는 편이 낫다.
 *
 * **표는 객체 리터럴이 아니라 `Map` 이다.** 객체로 두면 `provider` 가 `'toString'` 일 때
 * 상속된 함수가 반환되어 표시명 자리에 함수가 들어간다. 서버 값이라 그럴 일이 없어
 * 보이지만, 폴백이 "모르는 값" 을 정상 경로로 다루는 이상 그 경로가 안전해야 한다.
 */
const PROVIDER_NAMES = new Map<string, string>([
  ['KAKAO', '카카오'],
  ['NAVER', '네이버'],
])

/**
 * `null`(일반 계정)이면 `null` 을 돌려준다 — 호출부가 "연결됨" 문장을 아예 짓지 않게
 * 하기 위해서다. 빈 문자열을 돌려주면 `"로 연결됨"` 같은 문장이 만들어진다.
 */
export function providerName(provider: string | null): string | null {
  if (provider === null) return null

  const trimmed = provider.trim()
  if (trimmed.length === 0) return null

  return PROVIDER_NAMES.get(trimmed) ?? trimmed
}
