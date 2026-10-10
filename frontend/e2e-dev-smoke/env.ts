/**
 * dev 스모크(#757)가 읽는 환경 변수. **값을 로그·메시지에 싣지 않는다** — 이름만 말한다.
 *
 * | 이름                 | 무엇                       | CI 에서의 출처                     |
 * | -------------------- | -------------------------- | ---------------------------------- |
 * | `DEV_SMOKE_BASE_URL` | dev 프론트 주소            | 저장소 변수(없으면 워크플로 기본값) |
 * | `DEV_SMOKE_EMAIL`    | 스모크 전용 일반 계정      | 저장소 secret                      |
 * | `DEV_SMOKE_PASSWORD` | 위 계정의 비밀번호         | 저장소 secret                      |
 *
 * 계정 둘은 **로그인 setup 이 부를 때** 읽는다. 설정 파일이 읽으면 `--list` 처럼 로그인과
 * 무관한 실행까지 비밀값을 요구하게 된다.
 */
export const STATE_PATH = 'e2e-dev-smoke/.auth/user.json'

export function requireEnv(name: 'DEV_SMOKE_BASE_URL' | 'DEV_SMOKE_EMAIL' | 'DEV_SMOKE_PASSWORD') {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `${name} 가 비어 있다 — dev 스모크는 이 값을 환경 변수로만 받는다 (docs/testing-guide.md §13)`,
    )
  }
  return value
}
