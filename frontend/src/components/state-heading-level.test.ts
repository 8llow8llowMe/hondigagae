/**
 * 카드 안 상태 컴포넌트의 제목 레벨 — 이슈 #456① · #469.
 *
 * **무엇이 문제였나.** `EmptyState` · `ErrorState` 가 제목을 `h2` 로 고정해 내서, 제목을
 * 가진 `Surface`(L1) 안에 들어가면 한 카드에 형제 `h2` 가 둘이 됐다. `/mypage` 오류 실측
 * 아웃라인이 `h1:내 정보` → `h2:내 정보`(카드) → `h2:내 정보를 불러오지 못했어요` 였다 —
 * 카드 **내용**의 제목이 카드 **자신**의 제목과 형제로 읽힌다. 3a 가 "상태가 카드 머리를
 * 공유한다"(#451)를 규약으로 삼으면서 그런 자리가 계속 늘었고, 목록 항목은 이미 `h3` 로
 * 한 단 내려갔는데(#464 · #466) 상태 컴포넌트만 예외로 남아 있었다.
 *
 * ### 여기서 잠그는 결정 셋
 *
 * 1. **레벨을 내리는 기준은 "카드 안인가" 가 아니라 "그 카드가 `h2` 를 갖는가" 다.**
 *    `aria-label` 만 있는 카드(담기 화면 · AI 작업 상태 · 반려견 수정)는 위에 `h2` 가 없어
 *    `h2` 가 맞다 — 거기서 내리면 `h1` 과 사이가 비어 레벨을 건너뛴다.
 * 2. **`inset` 에서 유도하지 않는다.** 두 축은 이미 갈려 있다 — 카드 안인데 `inset` 을 안 준
 *    자리가 열 곳이고(#485), 반대로 카드 밖인데 카드 글줄에 맞추려 `inset="card"` 를 쓰는
 *    자리도 있다(`ai-plan-job-view` 의 담기 패널). 한쪽에서 다른 쪽을 읽으면 그 열 곳이
 *    조용히 `h3` 가 된다. `Surface` 가 context 로 내려보낼 수도 없다 — 서버 컴포넌트다.
 * 3. **prop 으로 뚫는 것은 값이 실제로 갈리는 둘뿐이다** (`PlaceListSection` ·
 *    `EmergencySection`). 나머지는 카드가 한 종류라 호출처에서 `3` 을 준다 —
 *    #422 의 "미리 만들지 않는다". 갈리는 날 같은 모양으로 바꾼다.
 *
 * ### 왜 소스 단언인가
 *
 * 라우트 상태 파일(`error.tsx`)은 Next 가 세그먼트에 꽂는 규약 파일이라 node 환경에서
 * 라우트로서 렌더할 방법이 없고(`testing-guide.md` §1), 기능 쪽도 카드를 그리는 곳과
 * 상태를 그리는 곳이 **다른 파일**이라 한쪽만 렌더해서는 짝을 볼 수 없다. 여기서 지키려는
 * 것이 바로 그 짝이다 — **카드 쪽이 제목을 걷으면 이 단언이 깨져야 한다** (#464 폭
 * 드리프트를 잡은 방식). `route-state-surface.test.ts` 와 같은 방식이다.
 *
 * **주석을 걷은 사본에 대해 단언한다 — 여기서는 방향이 반대다.** 형제 파일들은 주석에
 * 속아 **통과**하는 것을 막으려고 걷는데(#451), 이 파일이 실제로 겪는 것은 그 반대다:
 * `place-map-view` · `plan-add-place-view` 는 **넘기지 않는다는 사실을 주석으로 적어 두었고**
 * 그 주석에 `headingLevel` 이라는 낱말이 들어 있어, 걷지 않으면 "넘기지 않는다" 단언이
 * 코드와 무관하게 깨진다. 확인한 그대로 적는다 — `strip` 을 항등함수로 두면 24개 중
 * `세 사용처가 실제로 갈린다` 하나가 **헛되이 실패**한다 (다른 스물셋은 그대로 통과).
 *
 * **그래도 통과 쪽 위험이 없지는 않다.** `stateTags()` 가 집는 것은 열기 태그 안쪽이라
 * 주석이 그 안에 들어올 수 있다 — 실제로 `place-list-view` · `plan-add-place-view` ·
 * `place-map-view` 셋이 태그 안에 `/* … *&#47;` 로 근거를 적고 있다. 누가 거기에
 * `headingLevel={3}` 을 인용하면 걷지 않는 한 그 태그가 통과한다.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** 블록 주석과 줄 주석을 걷은 소스 — 계약은 코드에만 있다 */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function code(relative: string): string {
  return strip(readFileSync(`${ROOT}${relative}`, 'utf8'))
}

/**
 * `<EmptyState …>` · `<ErrorState …>` 의 **열기 태그**를 통째로 집는다 (여러 줄).
 *
 * **정규식으로 하지 않는다.** `/<(?:Empty|Error)State\b[\s\S]*?\/>/` 는 **prop 안에 든
 * self-closing 자식의 `/>` 에서 잘린다.** 저장소 전체 80개 태그를 두 방식으로 돌려 센
 * 결과 실제로 갈리는 것이 **셋**이고 전부 `action={<PlaceBackLink />}` 다 —
 * `place-detail-section.tsx` 둘과 `app/(main)/places/[placeId]/not-found.tsx` 하나.
 * **마지막 하나는 아래 열두 파일 표에 들어 있다.**
 *
 * 오늘의 판정은 그대로다(셋 다 `2` 이고 `headingLevel` 이 아예 없다). 하지만 그 세그먼트가
 * 제목 있는 카드를 갖게 되는 날, `headingLevel={3}` 을 `action` **뒤에** 적으면 잘린 사본에
 * 안 들어와 **코드는 맞는데 단언이 깨진다.** prop 순서가 계약이 되는 것은 함정이다.
 *
 * `<ButtonLink …>…</ButtonLink>` 처럼 자식을 감싸는 형태는 `/>` 가 없어 잘리지 않는다 —
 * 나머지 다섯 호출처가 그 모양이라 정규식으로도 통과했다. 그 우연에 기대지 않는다.
 *
 * 그래서 중괄호 깊이를 세며 **깊이 0 의 `>`** 까지 걷는다. 문자열 안의 괄호는 세지 않는다.
 */
function stateTags(source: string): string[] {
  const tags: string[] = []

  for (const start of [...source.matchAll(/<(?:Empty|Error)State\b/g)].map((m) => m.index)) {
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

describe('EmptyState · ErrorState — 제목 레벨 prop', () => {
  /*
    **둘을 한 배열로 돌리지 않는다.** `EmptyState` 는 `onRetry` 가 없고 `ErrorState` 는
    필수라 props 타입이 갈린다 — 배열로 묶으면 `createElement` 가 union 을 못 받는다.
  */
  it('기본은 h2 다 — 카드 밖이면 위가 페이지 h1 하나다', () => {
    const empty = renderToStaticMarkup(createElement(EmptyState, { title: '결과가 없어요' }))
    const error = renderToStaticMarkup(
      createElement(ErrorState, { title: '못 불러왔어요', onRetry: () => undefined }),
    )

    for (const markup of [empty, error]) {
      expect(markup).toContain('<h2')
      expect(markup).not.toContain('<h3')
    }
  })

  it('headingLevel={3} 이면 h3 로 낸다 — 크기는 그대로다', () => {
    const empty = renderToStaticMarkup(
      createElement(EmptyState, { title: '결과가 없어요', headingLevel: 3 }),
    )
    const error = renderToStaticMarkup(
      createElement(ErrorState, {
        title: '못 불러왔어요',
        headingLevel: 3,
        onRetry: () => undefined,
      }),
    )

    for (const markup of [empty, error]) {
      expect(markup).toContain('<h3')
      expect(markup).not.toContain('<h2')
      // 레벨만 바꾼다 — 카드 제목(text-title-2)보다 이미 작아 더 줄일 것이 없다
      expect(markup).toContain('text-body-1')
    }
  })
})

/**
 * 제목 있는 카드가 **같은 파일**에 있는 화면들. 카드와 상태가 한눈에 보이므로
 * 호출처에서 `3` 을 직접 준다.
 */
const OWNS_ITS_CARD = [
  { path: 'src/features/ai-plan/ai-plan-create-view.tsx', states: 2 },
  { path: 'src/features/favorite/favorite-list-section.tsx', states: 2 },
  { path: 'src/features/member/my-page-sections.tsx', states: 1 },
  { path: 'src/features/pet/pet-list-section.tsx', states: 2 },
  { path: 'src/features/plan/plan-create-view.tsx', states: 2 },
] as const

describe('제목 있는 카드를 스스로 그리는 화면', () => {
  it.each(OWNS_ITS_CARD)('$path — 카드가 h2 를 그리므로 상태는 전부 h3 다', ({ path, states }) => {
    const source = code(path)

    // 짝의 한쪽 — 이 파일이 제목 있는 카드를 그린다는 사실
    expect(source).toMatch(/<Surface\b[^>]*\btitle=/)

    const tags = stateTags(source)
    expect(tags).toHaveLength(states)
    for (const tag of tags) {
      expect(tag).toContain('headingLevel={3}')
    }
  })
})

/**
 * 카드를 **호출처가** 그리는 화면들. 값이 갈리는 사용처가 없어 prop 을 뚫지 않았고,
 * 그래서 카드 쪽 파일을 여기서 함께 잠근다 — 카드가 제목을 잃으면 이 단언이 깨진다.
 */
const CARD_IN_PARENT = [
  {
    path: 'src/features/plan/plan-list-section.tsx',
    states: 4,
    card: { path: 'src/features/plan/plan-list-view.tsx', titleId: 'plan-list-heading' },
  },
  {
    path: 'src/features/pet/pet-form.tsx',
    states: 1,
    card: { path: 'src/features/pet/pet-edit-view.tsx', title: 'messages.pet.editFormTitle' },
  },
] as const

describe('카드를 호출처가 그리는 화면', () => {
  it.each(CARD_IN_PARENT)('$path — 상태는 h3 이고 카드 쪽과 짝으로 잠근다', (entry) => {
    const source = code(entry.path)

    const tags = stateTags(source)
    expect(tags).toHaveLength(entry.states)
    for (const tag of tags) {
      expect(tag).toContain('headingLevel={3}')
    }

    // 짝의 반대쪽 — 그 카드가 실제로 제목을 갖는다
    const card = code(entry.card.path)
    expect(card).toMatch(/<Surface\b[^>]*\btitle=/)
    if ('titleId' in entry.card) {
      expect(card).toContain(entry.card.titleId)
    } else {
      expect(card).toContain(entry.card.title)
    }
  })
})

/**
 * 같은 컴포넌트가 **부모에 따라 갈리는** 둘. 여기만 prop 으로 뚫었다.
 *
 * `PlaceListSection` 은 셋에서 쓰인다 — `/places`(제목 있는 카드) · 담기 화면
 * (`aria-label` 만 있는 카드) · 지도 SDK 실패 폴백(카드 없음).
 * `EmergencyBoardSection` 은 둘 — 목록 갈래(제목 있는 카드) · 지도 폴백(카드 없음).
 */
describe('부모에 따라 갈리는 둘 — 담는 곳이 정한다', () => {
  it('PlaceListSection 은 headingLevel 을 받아 네 상태에 그대로 넘긴다', () => {
    const source = code('src/features/place/place-list-section.tsx')

    expect(source).toContain('headingLevel?: 2 | 3')
    expect(source).toContain('headingLevel = 2')

    const tags = stateTags(source)
    expect(tags).toHaveLength(4)
    for (const tag of tags) {
      expect(tag).toContain('headingLevel={headingLevel}')
    }
  })

  it('EmergencySection 도 같은 모양이다 — 0건 안내 제목까지 같은 레벨을 쓴다', () => {
    const source = code('src/features/emergency/emergency-section.tsx')

    expect(source).toContain('headingLevel?: 2 | 3')
    for (const tag of stateTags(source)) {
      expect(tag).toContain('headingLevel={headingLevel}')
    }

    /*
      0건 안내(`narrowedTitle`)는 `EmptyState` 갈래와 **같은 자리에 배타적으로** 서는
      같은 상태다. `h3` 로 박혀 있어 지도 폴백에서 `h1` → `h3` 로 건너뛰었다.
    */
    expect(source).toContain('const NarrowedHeading = `h${headingLevel}`')
    expect(source).not.toMatch(/<h3[^>]*>\{messages\.emergency\.narrowedTitle\}/)
  })

  it('세 사용처가 실제로 갈린다 — 제목 있는 카드에서만 3 을 넘긴다', () => {
    expect(code('src/features/place/place-list-view.tsx')).toContain('headingLevel={3}')
    expect(code('src/features/emergency/emergency-list-view.tsx')).toContain('headingLevel={3}')

    // `aria-label` 만 있는 카드 · 카드 없음 — 넘기지 않아 기본값 2 로 남는다
    expect(code('src/features/plan/plan-add-place-view.tsx')).not.toContain('headingLevel')
    expect(code('src/features/place/place-map-view.tsx')).not.toContain('headingLevel')
  })
})

/**
 * 라우트 상태 파일 열둘 — `route-state-surface.test.ts` 가 잡아 둔 카드 판정과 **같은 표**다.
 *
 * 제목 있는 카드는 다섯이고, `aria-label` 만 있는 셋과 카드가 없는 넷은 `h2` 로 남는다.
 * 열둘을 모두 적는 이유는 **빠뜨림을 잡기 위해서다** — 다섯만 적으면 새 세그먼트가
 * 생겼을 때 아무 단언도 깨지지 않는다.
 */
const ROUTE_STATE_FILES = [
  { path: 'app/(main)/ai-plans/new/error.tsx', level: 3 },
  { path: 'app/(main)/favorites/error.tsx', level: 3 },
  { path: 'app/(main)/mypage/error.tsx', level: 3 },
  { path: 'app/(main)/pets/error.tsx', level: 3 },
  { path: 'app/(main)/places/(list)/error.tsx', level: 3 },
  { path: 'app/(main)/ai-plans/jobs/[jobId]/error.tsx', level: 2 },
  { path: 'app/(main)/pets/[petId]/error.tsx', level: 2 },
  { path: 'app/(main)/pets/[petId]/not-found.tsx', level: 2 },
  { path: 'app/(main)/places/[placeId]/error.tsx', level: 2 },
  { path: 'app/(main)/places/[placeId]/not-found.tsx', level: 2 },
  { path: 'app/(main)/plans/[planId]/error.tsx', level: 2 },
  { path: 'app/(main)/plans/[planId]/not-found.tsx', level: 2 },
] as const

describe('라우트 상태 파일 — 카드가 h2 를 가질 때만 내린다', () => {
  it.each(ROUTE_STATE_FILES)('$path → h$level', ({ path, level }) => {
    const source = code(path)
    const titledCard = /<Surface\b[^>]*\btitle=/.test(source)

    // 레벨의 근거는 "카드가 제목을 갖는가" 하나다 — 둘을 함께 단언해 짝을 잠근다
    expect(titledCard).toBe(level === 3)

    const tags = stateTags(source)
    expect(tags).toHaveLength(1)
    expect(tags[0]?.includes('headingLevel={3}')).toBe(level === 3)
  })
})
