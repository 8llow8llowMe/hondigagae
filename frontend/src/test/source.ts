import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * 소스 문자열을 단언하는 테스트용 헬퍼 — 이슈 #458.
 *
 * ### 왜 소스를 문자열로 읽나
 *
 * 이 저장소의 vitest 는 `environment: 'node'` 라 마크업 **문자열**만 본다
 * (`docs/testing-guide.md` §1). 그래서 못 보는 것이 둘이다:
 *
 * 1. **라우트 규약 파일** — `error.tsx` · `not-found.tsx` · `loading.tsx` · `layout.tsx` 는
 *    Next 가 세그먼트에 꽂는 것이라 라우트로서 렌더할 방법이 없다. `layout.tsx` 는 async
 *    서버 컴포넌트이기까지 하다.
 * 2. **한 파일에 없는 계약** — 카드를 그리는 곳과 상태를 그리는 곳이 다른 파일이면
 *    한쪽만 렌더해서는 그 짝을 볼 수 없다.
 *
 * 그럴 때 지키려는 것도 렌더 결과가 아니라 **표면 계약**이다 — 무엇이 바닥이고 무엇이
 * 카드이며 인셋·폭·제목 레벨이 어느 값인가.
 *
 * ### 왜 주석을 걷나
 *
 * **이 저장소의 주석은 근거를 길게 적어 클래스명·컴포넌트명이 그대로 등장한다.**
 * 걷지 않으면 단언이 **주석 문자열에 속아 통과한다** — #451 에서 실제로 났다. 뒤이어
 * `route-state-surface.test.ts` 가 뮤테이션으로 확인한 것만 셋이다: `md:px-10` ·
 * `ErrorState`/`onRetry` · 카드를 그리는 여덟의 `<Surface … title={messages.…}>`.
 *
 * **반대 방향도 있다.** "이 prop 을 넘기지 않는다" 를 주석으로 적어 둔 파일에서는, 걷지
 * 않으면 그 낱말 때문에 단언이 **헛되이 실패**한다 (`state-heading-level.test.ts`).
 *
 * ### 왜 한 곳으로 모았나
 *
 * 아홉 파일이 각자 갖고 있었고 **이름도 범위도 갈렸다** — `strip`+`code` 넷,
 * `withoutComments`, `source`, 인라인 `replace` 둘, `code` 둘. 그중 **넷은 블록 주석만
 * 걷고 넷은 줄 주석까지 걷어** 같은 이름이 다른 일을 했다. 사본이 늘 때마다 또 갈린다.
 */

/** 저장소 루트(`frontend/`) 기준 경로를 실제 파일 경로로 바꾼다 */
function repoPath(relative: string): string {
  return fileURLToPath(new URL(`../../${relative}`, import.meta.url))
}

/**
 * 블록 주석(`/* … *&#47;`)과 **줄 첫머리의** 줄 주석(`// …`)을 걷는다.
 *
 * **줄 첫머리만 본다** (`^\s*\/\/`). 줄 가운데의 `//` 는 그대로 둔다 — `https://` 가 든
 * 문자열 리터럴을 잘못 자르지 않기 위해서다 (`source.test.ts` 가 잠근다).
 *
 * **한계 두 가지를 알고 쓴다.** 문자열·템플릿 리터럴 안에 `/*` 나 줄 첫머리 `//` 가
 * 들어 있으면 그것도 걷는다. 계약 단언에 쓰는 범위에서는 부딪힌 적이 없고, 부딪히면
 * 그때 파서를 들인다 — 지금 넣으면 쓰지 않는 복잡도다.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** 저장소 루트 기준 경로의 소스를 **그대로** 읽는다 (주석 포함) */
export function readSource(relative: string): string {
  return readFileSync(repoPath(relative), 'utf8')
}

/**
 * 저장소 루트 기준 경로의 소스를 **주석을 걷어** 읽는다.
 *
 * 계약 단언은 기본적으로 이것을 쓴다 — 계약은 코드에만 있다.
 */
export function readSourceWithoutComments(relative: string): string {
  return stripComments(readSource(relative))
}

/**
 * `pattern` 으로 시작하는 JSX **열기 태그**를 통째로 집는다 (여러 줄).
 *
 * **정규식으로 하지 않는다.** `/<Foo\b[\s\S]*?\/>/` 는 **prop 안에 든 self-closing 자식의
 * `/>` 에서 잘린다** — `action={<PlaceBackLink />}` 가 저장소에 실재한다. 잘린 사본으로
 * 단언하면 prop 순서가 계약이 되어, 코드는 맞는데 단언이 깨진다.
 *
 * 같은 이유로 `/<Surface\b[^>]*\btitle=/` 처럼 `[^>]*` 로 태그 안을 훑는 것도 피한다 —
 * `title` 앞에 `>` 를 품은 prop(`description={<>…</>}`)이 오면 못 찾는다.
 *
 * 그래서 중괄호 깊이를 세며 **깊이 0 의 `>`** 까지 걷는다. 문자열 안의 괄호는 세지 않는다.
 *
 * @param pattern 태그 시작을 찾는 전역 정규식 (예: `/<(?:Empty|Error)State\b/g`)
 */
export function openingTags(source: string, pattern: RegExp): string[] {
  const tags: string[] = []

  for (const start of [...source.matchAll(pattern)].map((match) => match.index)) {
    let depth = 0
    let quote: string | null = null

    for (let i = start; i < source.length; i += 1) {
      const char = source[i] as string

      if (quote !== null) {
        if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char
        continue
      }
      if (char === '{') depth += 1
      else if (char === '}') depth -= 1
      else if (char === '>' && depth === 0) {
        tags.push(source.slice(start, i + 1))
        break
      }
    }
  }

  return tags
}
