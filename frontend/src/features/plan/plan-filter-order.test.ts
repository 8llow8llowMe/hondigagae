import { describe, expect, it } from 'vitest'

import { readSourceWithoutComments } from '@/test/source'

/**
 * 일정 목록의 **읽는 순서** — 이슈 #536.
 *
 * 1024 미만에서 상태 탭·반려견 칩이 페이지 제목 `여행 일정` **위**에 섰다. 필터가 제목보다
 * 먼저 읽혀, 이 화면이 무엇인지 알기 전에 조건부터 지나게 됐다 (375 · 768 실측).
 *
 * 고친 모양은 **필터가 목록 카드 안, 제목 줄 아래**다. `Surface` 는 `title` 을 먼저 그리고
 * `children` 을 뒤에 그리므로 — 자식이라는 사실이 곧 "제목 뒤" 다 — 여기서는 두 컨트롤이
 * `<Surface>` 와 `</Surface>` **사이**에 있고 목록(`{section}`)보다 **앞**인지를 본다.
 *
 * **소스의 등장 순서를 본다.** `PlanListView` 는 `usePlanList` · `usePetList` · `useRouter`
 * 를 부르는 client 컴포넌트라 `environment: 'node'` 에서 렌더할 수 없다
 * (`docs/testing-guide.md` §1, `src/test/source.ts`). 지키려는 것도 픽셀이 아니라 **자리**다.
 *
 * **주석을 걷고 본다.** 이 파일의 주석이 `Surface` · `PlanStatusTabs` 를 근거로 길게
 * 인용하고 있어, 걷지 않으면 단언이 주석 문자열에 속아 통과한다 (#451 에서 실제로 났다).
 */

const view = readSourceWithoutComments('src/features/plan/plan-list-view.tsx')

/** `needle` 이 소스에 처음 나오는 자리. 없으면 단언이 바로 실패하도록 -1 을 그대로 돌려준다 */
function at(needle: string | RegExp): number {
  return typeof needle === 'string' ? view.indexOf(needle) : view.search(needle)
}

/**
 * 카드를 여는 태그.
 *
 * **`'<Surface'` 로 찾지 않는다** — 그것은 바깥 `<SurfaceStack>` 에 먼저 걸린다. 뮤테이션으로
 * 확인했다: 필터를 카드 밖(스택 바로 아래)으로 되돌려도 단언 넷이 전부 통과했다.
 */
const CARD_OPEN = /<Surface[\s>]/

describe('일정 목록의 제목·필터·목록 순서 (#536)', () => {
  it('모바일 필터가 목록 카드 안에 있다', () => {
    const cardOpen = at(CARD_OPEN)
    const cardClose = at('</Surface>')
    const tabs = at('<PlanStatusTabs')
    const chips = at('<PlanPetChips')

    expect(cardOpen, '제목을 그리는 `Surface` 가 있어야 한다').toBeGreaterThanOrEqual(0)
    expect(tabs, '상태 탭이 있어야 한다').toBeGreaterThan(cardOpen)
    expect(chips, '반려견 칩이 있어야 한다').toBeGreaterThan(cardOpen)
    expect(chips, '두 컨트롤이 카드가 닫히기 전에 있다').toBeLessThan(cardClose)
    expect(tabs, '상태 탭이 반려견 칩보다 먼저다 (아트보드 04)').toBeLessThan(chips)
  })

  it('필터가 목록보다 먼저다', () => {
    expect(at('<PlanPetChips'), '칩은 목록을 좁히는 도구라 결과보다 앞에 선다').toBeLessThan(
      at('{section}'),
    )
  })

  /*
    같은 축을 레일과 칩이 한 화면에 두 번 보여주지 않게 하는 스위치다. 이것이 빠지면
    1024 이상에서 좌측 레일과 카드 안 탭이 함께 뜬다.
  */
  it('카드 안 필터는 1024 미만 전용이다', () => {
    const wrapper = at('<div className="lg:hidden">')

    expect(wrapper, '`lg:hidden` 래퍼가 있어야 한다').toBeGreaterThan(at(CARD_OPEN))
    expect(wrapper, '래퍼가 두 컨트롤을 감싼다').toBeLessThan(at('<PlanStatusTabs'))
  })

  /*
    **데스크톱 레일은 이 순서 문제가 없다** — 제목 줄 옆 열이다. 그래서 `aside` 는 그대로
    `SurfaceStack` 앞에 남고, 제목 탐색 순서를 지키는 `sr-only h1` 이 그보다 앞이다 (#472).
  */
  it('레일과 h1 의 자리는 그대로다', () => {
    expect(at('<h1 className="sr-only">')).toBeLessThan(at('<aside'))
    expect(at('<PlanFilterRail')).toBeLessThan(at('<SurfaceStack'))
  })
})
