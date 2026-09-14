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
 * 1. **레벨을 내리는 기준은 "카드 안인가" 가 아니라 "바로 위에 `h2` 가 있는가" 다.**
 *    `aria-label` 만 있는 카드(AI 작업 상태 · 반려견 수정 · 담기 목록)는 위에 `h2` 가 없어
 *    `h2` 가 맞다 — 거기서 내리면 `h1` 과 사이가 비어 레벨을 건너뛴다.
 *    **카드만이 아니다**: `title` 을 넘긴 `BottomSheet` 도 `h2` 를 그리고, 그 제목은
 *    `text-body-1 font-semibold` 로 상태 제목과 **클래스까지 같다**. 시트 여섯 곳도 `3` 이다.
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
 *
 * ### 이 파일이 못 보는 것 — 한계를 적어 둔다
 *
 * `drawsHeading()` 은 **파일에 제목 있는 면이 하나라도 있는가**만 본다. 한 파일에 면이
 * 여럿이면 **그 상태가 그중 어느 면 안인지 구별하지 못한다.** 반례가 실재한다:
 * `pet-edit-view.tsx` 는 `aria-label` 만 있는 카드 셋(로딩 갈래)과 제목 있는 카드 둘을
 * 함께 갖는다 — 폼이 `aria-label` 쪽으로 옮겨가도 이 단언은 그대로 통과한다.
 *
 * **트리를 파싱하지 않는 대가다.** 대신 진짜 구조는 e2e 가 본다 —
 * `e2e/surface.spec.ts` 의 `카드 안 상태 제목` 이 실제 브라우저에서 카드 `h2` 아래
 * 상태가 `h3` 로 서는지 확인한다. 여기서는 **"값이 호출처에 적혀 있는가" 와 "짝의
 * 반대쪽이 제목을 갖는가"** 둘만 잠근다.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { openingTags, readSourceWithoutComments as code } from '@/test/source'

function stateTags(source: string): string[] {
  return openingTags(source, /<(?:Empty|Error)State\b/g)
}

/**
 * **제목을 그리는 면이 있는가** — 제목 있는 `Surface`(L1) 또는 `title` 을 넘긴
 * `BottomSheet`. 둘 다 `h2` 를 그리고, 시트 제목은 `text-body-1 font-semibold` 로
 * `EmptyState` 제목과 **클래스까지 같다**.
 *
 * 여기도 정규식(`/<Surface\b[^>]*\btitle=/`)을 쓰지 않는다 — `[^>]*` 라 `title` 앞에
 * `>` 를 품은 prop(`description={<>…</>}` 같은)이 오면 못 찾아 **prop 순서가 계약이 된다.**
 * 태그를 정확히 집어 그 안에서 찾는다.
 */
function drawsHeading(source: string): boolean {
  return openingTags(source, /<(?:Surface|BottomSheet)\b/g).some((tag) => /\btitle=/.test(tag))
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

    // 짝의 한쪽 — 이 파일이 제목 있는 면을 그린다는 사실
    expect(drawsHeading(source)).toBe(true)

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
    cards: [{ path: 'src/features/plan/plan-list-view.tsx', probe: 'plan-list-heading' }],
  },
  {
    path: 'src/features/pet/pet-form.tsx',
    states: 1,
    /*
      **호출부 둘을 모두 잠근다.** `pet-form.tsx` 주석이 "등록·수정 **둘 다** 제목 있는 카드
      안" 을 근거로 대는데 한쪽만 보면 `pet-create-view` 가 제목을 잃어도 아무것도 안 깨진다.
    */
    cards: [
      { path: 'src/features/pet/pet-edit-view.tsx', probe: 'messages.pet.editFormTitle' },
      { path: 'src/features/pet/pet-create-view.tsx', probe: 'pet-create-heading' },
    ],
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

    // 짝의 반대쪽 — 그 카드들이 실제로 제목을 갖는다
    for (const card of entry.cards) {
      const cardSource = code(card.path)
      expect(drawsHeading(cardSource)).toBe(true)
      expect(cardSource).toContain(card.probe)
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

  it('네 사용처가 실제로 갈린다 — 제목 있는 카드에서만 3 을 넘긴다', () => {
    /*
      **셋이 이쪽으로 돌아왔다** (#556). #531 · #537 이 제목을 카드 **위**로 올렸을 때는
      목록 카드가 `aria-label` 만 갖는 면이라 그 안의 상태가 `h2` 였다. 제목이 카드 **머리**
      로 들어오면서 카드가 다시 `h2` 를 그리므로 상태는 한 단 내려간 `h3` 다.

      **값을 지워 기본값에 맡기지 않는다** — 지우면 "이 카드가 제목을 갖는가" 라는 판단이
      소스에서 사라져, 제목을 다시 카드 밖으로 빼는 변경이 아무 데서도 걸리지 않는다.
    */
    expect(code('src/features/place/place-list-view.tsx')).toContain('headingLevel={3}')
    expect(code('src/features/emergency/emergency-list-view.tsx')).toContain('headingLevel={3}')
    expect(code('src/features/plan/plan-add-place-view.tsx')).toContain('headingLevel={3}')

    // 카드 없음(지도 SDK 폴백) — 넘기지 않아 기본값 2 로 남는다
    expect(code('src/features/place/place-map-view.tsx')).not.toContain('headingLevel')
  })
})

/**
 * **`BottomSheet` 안 여섯** — 카드가 아니지만 같은 증상이다.
 *
 * `bottom-sheet.tsx` 가 `title` 을 `h2` 로 그리고 그 클래스가 `text-body-1 font-semibold` 라
 * 상태 제목과 **완전히 같다.** 시트가 `role="dialog" aria-modal="true"` 라 개요 손상 범위는
 * 카드보다 좁지만, 규칙을 면 종류별로 갈라 둘 이유가 없어 같이 내린다.
 */
const SHEETS = [
  { path: 'src/features/plan/place-add-to-plan-sheet.tsx', states: 4 },
  /*
    **넷이다** — `저장한 장소` 둘(오류 · 0건)과 `검색` 둘(오류 · 0건). #431 로 검색 탭이
    열리며 둘에서 넷이 됐다. **탭이 늘어나는 쪽으로 드리프트가 난다** — 새 탭에 상태를
    붙이며 레벨을 빠뜨리는 것이 이 단언이 막는 모양이다.
  */
  { path: 'src/features/ai-plan/ai-plan-place-picker-sheet.tsx', states: 4 },
] as const

describe('BottomSheet 안 상태 — 시트 제목도 h2 다', () => {
  it.each(SHEETS)('$path — 상태는 전부 h3 다', ({ path, states }) => {
    const source = code(path)

    // 짝의 한쪽 — 이 시트가 `title` 을 넘겨 `h2` 를 그린다
    expect(drawsHeading(source)).toBe(true)

    const tags = stateTags(source)
    expect(tags).toHaveLength(states)
    for (const tag of tags) {
      expect(tag).toContain('headingLevel={3}')
    }
  })

  it('BottomSheet 이 제목을 h2 로, 상태와 같은 클래스로 그린다 — 이 짝이 전제다', () => {
    const sheet = code('src/components/bottom-sheet.tsx')

    expect(sheet).toContain('<h2 className="text-body-1 text-fg font-semibold">{title}</h2>')
  })
})

/**
 * 라우트 상태 파일 열둘 — `route-state-surface.test.ts` 가 잡아 둔 카드 판정과 **같은 표**다.
 *
 * 제목 있는 카드는 넷이고, `aria-label` 만 있는 넷과 카드가 없는 넷은 `h2` 로 남는다.
 * (#531 로 `places/(list)` 가 앞에서 뒤로 옮겨 왔다 — 다섯에서 넷이 됐다.)
 * 열둘을 모두 적는 이유는 **빠뜨림을 잡기 위해서다** — 넷만 적으면 새 세그먼트가
 * 생겼을 때 아무 단언도 깨지지 않는다.
 */
const ROUTE_STATE_FILES = [
  { path: 'app/(main)/ai-plans/new/error.tsx', level: 3 },
  { path: 'app/(main)/favorites/error.tsx', level: 3 },
  { path: 'app/(main)/mypage/error.tsx', level: 3 },
  { path: 'app/(main)/pets/error.tsx', level: 3 },
  { path: 'app/(main)/ai-plans/jobs/[jobId]/error.tsx', level: 2 },
  { path: 'app/(main)/pets/[petId]/error.tsx', level: 2 },
  { path: 'app/(main)/pets/[petId]/not-found.tsx', level: 2 },
  /* 제목이 카드 **머리** 로 돌아와 카드가 다시 `h2` 를 그린다 — `3` 이다 (#556) */
  { path: 'app/(main)/places/(list)/error.tsx', level: 3 },
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
