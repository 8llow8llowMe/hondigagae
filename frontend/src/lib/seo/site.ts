/**
 * 검색 노출의 기준 도메인 (#1130).
 *
 * **운영만 색인한다.** dev 는 nginx 가 `X-Robots-Tag: noindex` 를 붙이지만, 그 헤더는 저장소
 * 밖 설정이라 언제든 빠질 수 있다. `robots.txt` 가 같은 말을 한 번 더 해 둔다 — 운영이 아닌
 * 빌드가 검색 결과에 올라가면 운영과 같은 글이 두 도메인에 생겨 순위가 나뉜다.
 *
 * 값은 `NEXT_PUBLIC_SITE_URL` 이다. 빌드 시점에 인라인되므로 dev/prod 를 각각 빌드한다
 * (`Jenkinsfile-frontend-web`). `process.env` 는 반드시 리터럴로 읽는다 — 동적 인덱싱은
 * 치환되지 않는다.
 */
export const SITE_NAME = '혼디가개'

/** 정규 도메인. `hondigagae.com`(apex)·`http://` 는 nginx 가 이리로 301 한다 */
export const PRODUCTION_SITE_URL = 'https://www.hondigagae.com'

const LOCAL_SITE_URL = 'http://localhost:3000'

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? LOCAL_SITE_URL
}

/** 끝 슬래시·경로가 섞여 들어와도 출처(origin)로 비교한다 */
export function isProductionSite(url: string = siteUrl()): boolean {
  try {
    return new URL(url).origin === PRODUCTION_SITE_URL
  } catch {
    return false
  }
}

/** 상대 경로를 절대 URL 로. 사이트맵·구조화 데이터는 상대 경로를 받지 않는다 */
export function absoluteUrl(path: string, base: string = siteUrl()): string {
  return new URL(path, base).toString()
}
