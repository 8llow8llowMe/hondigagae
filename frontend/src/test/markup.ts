/**
 * 렌더 결과 마크업을 단언하는 테스트용 헬퍼 — 이슈 #539.
 *
 * 소스 **파일**을 문자열로 읽는 `src/test/source.ts` 와 다르다. 이쪽은
 * `renderToStaticMarkup` 이 낸 **렌더 결과**를 다룬다.
 *
 * ### 왜 모듈로 올렸나
 *
 * `classesOf` 가 `surface.test.ts` · `profile-card.test.ts` 에 **바이트 단위로 같은 사본**
 * 으로 있었고 #539 가 세 번째를 만들 뻔했다. `source.ts` 헤더가 같은 패턴을 실패 사례로
 * 적어 둔 그대로다 — "아홉 파일이 각자 갖고 있었고 이름도 범위도 갈렸다. **사본이 늘
 * 때마다 또 갈린다.**"
 *
 * `my-page.test.ts` 의 `classTokens` 는 태그를 받아 좁히는 사촌이라 합치지 않았다.
 */

/**
 * 마크업 안 모든 `class` 속성을 토큰 배열로 쪼갠다.
 *
 * **`toContain` 으로 클래스 문자열을 직접 보면 안 된다** — `border-border`(색 토큰)가
 * `border-b` 와 `border` 를, `min-w-11` 이 `w-11` 을, `not-sr-only` 가 `sr-only` 를
 * 부분 문자열로 품어 전부 오탐한다. `surface.test.ts` 가 실제로 두 번 걸렸던 함정이다.
 */
export function classesOf(markup: string): string[] {
  return [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
    (match[1] ?? '').split(/\s+/).filter((name) => name !== ''),
  )
}
