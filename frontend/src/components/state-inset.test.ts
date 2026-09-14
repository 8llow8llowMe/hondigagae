/**
 * 카드 안 상태 컴포넌트의 좌우 인셋 — 이슈 #485.
 *
 * **무엇이 문제였나.** `EmptyState` · `ErrorState` 의 `inset` 기본값은 `main`(16/40)인데,
 * 카드 안 글줄은 `card`(16/20)다. 카드 안에서 `inset` 을 안 주면 상태 글줄만 형제보다
 * **데스크톱에서 20px 오른쪽**으로 밀린다. 모바일(16)은 같아서 `md` 이상에서만 갈린다.
 *
 * 더 나쁜 것은 **같은 카드 안에서 로딩 → 오류 → 성공으로 상태가 바뀌는 동안 글자가 좌우로
 * 움직인다**는 것이다. 오류 화면에서 유일하게 만지는 것이 재시도 버튼이라 가장 눈에 띈다.
 * `ErrorState` 의 `inset` prop JSDoc 이 이 증상을 적어 두었는데, **prop 을 뚫어 놓고
 * 호출처가 안 주는 형태로 남아 있었다** — 홈 판정 자리는 실제로 로딩(40) → 오류(40) →
 * 성공(20) 으로 되돌아가 있었다.
 *
 * ### 여기서 잠그는 것
 *
 * **"카드 안 상태는 인셋을 명시한다."** 어떤 값인지까지 이 파일이 판정하지는 않는다 —
 * 값은 `card` 가 대부분이지만 레일 블록이면 `rail` 이 맞을 수 있어서다. 잠그는 것은
 * **기본값(`main`)으로 조용히 흘러가는 자리가 없다**는 사실이다. 그 침묵이 #485 였다.
 *
 * ### 왜 소스 단언인가
 *
 * `state-heading-level.test.ts` 와 같은 이유다 — 카드를 그리는 곳과 상태를 그리는 곳이
 * **다른 파일**이라 한쪽만 렌더해서는 짝을 볼 수 없고, 인셋은 렌더 결과가 아니라
 * **호출처에 값이 적혀 있는가**의 문제다. 스캐너(`openingTags`)도 그 파일에서 옮겨 왔다:
 * 정규식 `/<(?:Empty|Error)State\b[\s\S]*?\/>/` 는 **prop 안에 든 self-closing 자식의
 * `/>` 에서 잘려** `action={<PlaceBackLink />}` 같은 태그를 놓친다.
 *
 * ### 이 파일이 못 보는 것
 *
 * 카드 안인지 아닌지를 **파일 목록으로 정한다.** 트리를 파싱하지 않으므로, 목록에 없는
 * 파일이 나중에 카드 안에 상태를 두면 여기서는 안 걸린다. 실제 세로선은 e2e 가 본다.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function code(relative: string): string {
  return strip(readFileSync(`${ROOT}${relative}`, 'utf8'))
}

/**
 * `<EmptyState …>` · `<ErrorState …>` 의 열기 태그를 통째로 집는다 (여러 줄).
 * 중괄호 깊이를 세며 **깊이 0 의 `>`** 까지 걷는다 — `state-heading-level.test.ts` 와 같다.
 */
function openingTags(source: string, pattern: RegExp): string[] {
  const tags: string[] = []

  for (const start of [...source.matchAll(pattern)].map((m) => m.index)) {
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

function stateTags(source: string): string[] {
  return openingTags(source, /<(?:Empty|Error)State\b/g)
}

/**
 * 상태가 **전부 어떤 면 안에** 있는 화면들. 그래서 태그 하나도 빠짐없이 `inset` 을 갖는다.
 *
 * `states` 를 함께 잠그는 이유는 **태그가 늘어나는 쪽으로 드리프트가 나기 때문**이다 —
 * 새 상태를 하나 더 붙이면서 `inset` 을 빠뜨리는 것이 원래의 열 곳이 생긴 경로다.
 */
const INSET_REQUIRED = [
  /*
    넷 다 `plan-list-view.tsx` 의 제목 있는 카드 안이다 — 호출부가 하나뿐이라
    `plan-list-section` 이 값을 직접 적는다 (`headingLevel` 과 같은 판단).
  */
  { path: 'src/features/plan/plan-list-section.tsx', states: 4 },
  /* 등록·수정 두 화면 모두 제목 있는 카드 안이다 */
  { path: 'src/features/pet/pet-form.tsx', states: 1 },
  /*
    `plan-detail-section.tsx` 의 `aria-label` 카드 안. 제목이 없어 레벨은 2 로 남는다.

    **둘이 된 것은 #586 이다.** 저장이 붙으면서 실패가 생성 하나에서 **조회 실패**까지
    둘이 됐다.
  */
  { path: 'src/features/plan/plan-packing-list.tsx', states: 2 },
  /*
    홈은 다섯 전부 카드 안이다. **넷은 `card` 이고 하나는 레일 카드 안의 판정 자리**인데,
    그 자리도 형제가 `px-4 md:px-5` 라 `card` 다 (#485 에서 `rail` 에서 고쳤다).
  */
  { path: 'src/features/home/home-view.tsx', states: 5 },
] as const

describe('카드 안 상태 컴포넌트는 인셋을 명시한다 (#485)', () => {
  it.each(INSET_REQUIRED)('$path — 상태 태그 전부가 inset 을 갖는다', ({ path, states }) => {
    const tags = stateTags(code(path))

    expect(tags).toHaveLength(states)
    for (const tag of tags) {
      // 기본값 `main`(md 40) 으로 흘러가면 카드 글줄과 20px 갈린다
      expect(tag).toMatch(/\binset="/)
    }
  })
})

/**
 * 같은 카드 안에서 **로딩 → 오류 → 성공**이 같은 세로선에 서는가.
 *
 * 홈 판정 자리가 `ErrorState` JSDoc 이 지목한 바로 그 자리다. 셋이 서로 다른 파일·형태로
 * 그려져서(스켈레톤은 `INSET_CLASS`, 오류는 `inset` prop, 성공은 `WalkVerdict` 안의 문자열)
 * **한 화면만 봐서는 어긋남이 안 보인다.** 세 축을 한자리에서 잠근다.
 */
describe('홈 판정 자리 — 세 상태가 같은 세로선에 선다 (#485)', () => {
  it('로딩 스켈레톤이 카드 인셋을 쓴다', () => {
    const source = code('src/features/home/home-view.tsx')

    expect(source).toContain('INSET_CLASS.card')
    // 레일 인셋(md 40)이 이 카드 안으로 돌아오지 않는다
    expect(source).not.toContain('INSET_CLASS.rail')
  })

  it('오류가 카드 인셋을 쓴다', () => {
    const tags = stateTags(code('src/features/home/home-view.tsx'))

    for (const tag of tags) {
      expect(tag).toContain('inset="card"')
    }
  })

  it('성공(WalkVerdict · ProfileCard)이 같은 값을 쓴다 — 짝의 반대쪽', () => {
    for (const path of [
      'src/features/home/walk-verdict.tsx',
      'src/features/home/profile-card.tsx',
    ]) {
      expect(code(path)).toContain("'px-4 md:px-5'")
    }
  })
})

/**
 * **카드 밖인데 `inset="card"` 를 쓰는 자리** — 반대 방향의 의도적 예외다.
 *
 * AI 작업 화면의 담기 패널은 `AiPlanJobShell bare` 안이라 카드가 아니지만, 위 카드의 첫
 * 글자와 세로선을 맞추려고 카드 글줄 축을 쓴다. 근거가 호출처 주석에 남아 있다 —
 * **이 자리를 "빠뜨린 곳" 으로 오해해 되돌리지 않도록** 여기 적어 둔다.
 */
describe('카드 밖인데 card 인셋을 쓰는 예외', () => {
  it('ai-plan-job-view 의 담기 패널은 의도적으로 card 다', () => {
    const raw = readFileSync(`${ROOT}src/features/ai-plan/ai-plan-job-view.tsx`, 'utf8')

    expect(stateTags(strip(raw)).some((tag) => tag.includes('inset="card"'))).toBe(true)
    // 근거가 주석으로 남아 있다 (걷지 않은 원본에서 본다)
    expect(raw).toContain('카드 밖 L0 이고 인셋만 카드 안 글줄과 같은 축이라')
  })
})
