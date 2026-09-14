import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { messages } from '@/lib/messages'
import { KEYWORD_MAX_LENGTH } from '@/lib/url/keyword'
import { DEFAULT_PLACE_FILTERS } from '@/lib/url/place-filters'
import type { PlaceFilters } from '@/types/place'

/**
 * 장소 이름·주소 검색 입력 — #431 (지도 갈래 변형은 #596).
 *
 * **제출 → URL → 재조회 사슬은 e2e 가 잰다** (`e2e/place-search.spec.ts`). 여기서 잠그는
 * 것은 **마크업**이다: 랜드마크 · 라벨 · 상한 · 변형 넷은 조용히 깨지고, 깨져도 화면은
 * 멀쩡해 보인다.
 *
 * **`next/navigation` 을 목한다.** 이 컴포넌트는 `usePlaceFilterNav()` 로 URL 을 직접
 * 쓰는데(형제인 `EmergencySearchField` 는 `onFiltersChange` 를 prop 으로 받는다 — 상태를
 * 쥔 곳이 다르다), node 환경에는 라우터 컨텍스트가 없다. `nav-links.test.ts` 와 같은 방식.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/places',
  useSearchParams: () => new URLSearchParams(),
}))

const { PlaceSearchField } = await import('@/features/place/place-search-field')

function render(
  filters: PlaceFilters = DEFAULT_PLACE_FILTERS,
  extra: { compact?: boolean; id?: string; className?: string } = {},
) {
  return renderToStaticMarkup(createElement(PlaceSearchField, { filters, ...extra }))
}

describe('PlaceSearchField', () => {
  /* 보조기기가 이 구간을 이름으로 찾는다 */
  it('search 랜드마크와 접근성 이름을 낸다', () => {
    const markup = render()

    expect(markup).toContain('role="search"')
    expect(markup).toContain(messages.place.searchLabel)
  })

  it('sr-only 라벨이 입력을 가리킨다', () => {
    const markup = render()

    expect(markup).toContain('for="place-keyword"')
    expect(markup).toContain('id="place-keyword"')
  })

  /* `maxLength` 는 백엔드 상한과 같은 상수라(#421) 붙여넣기까지 여기서 막힌다 */
  it('검색 입력 문법과 길이 상한을 쓴다', () => {
    const markup = render()

    expect(markup).toContain('type="search"')
    expect(markup).toContain(`maxLength="${String(KEYWORD_MAX_LENGTH)}"`)
  })

  it('URL 의 검색어를 초기값으로 쓴다', () => {
    expect(render({ ...DEFAULT_PLACE_FILTERS, keyword: '미술관' })).toContain('value="미술관"')
  })
})

/**
 * 지도 위 오버레이 변형 (#596) — 375 실측으로 입력에 193px 밖에 없다
 * (토글 90 · 좌우 여백 16×2 · 아이콘 버튼 44 · 간격). 글자 버튼이면 177 로 줄어
 * placeholder 가 잘리고, **잘린 문구는 짧은 문구보다 나쁘다.**
 */
describe('PlaceSearchField — compact (지도 오버레이)', () => {
  it('제출 버튼이 글자 대신 아이콘이고 이름은 그대로 검색이다', () => {
    const markup = render(DEFAULT_PLACE_FILTERS, { compact: true })

    expect(markup).toContain(`aria-label="${messages.place.searchAction}"`)
    expect(markup).not.toContain(`>${messages.place.searchAction}</button>`)
    expect(markup).toContain('<svg')
  })

  it('짧은 placeholder 를 쓴다', () => {
    const markup = render(DEFAULT_PLACE_FILTERS, { compact: true })

    expect(markup).toContain(messages.place.searchPlaceholderShort)
    expect(markup).not.toContain(messages.place.searchPlaceholder)
  })

  /*
    같은 줄의 보기 토글·내 위치 버튼이 `shadow-md` 다. `box-shadow` 가 아니라 `drop-shadow`
    인 것이 핵심 — 배경 없는 `flex gap-2` 폼이라 `shadow-md` 면 입력과 버튼 **사이 틈까지**
    한 덩어리로 깔린다.
  */
  it('지도 위에서 뜨도록 drop-shadow 를 건다 — 목록 갈래에는 없다', () => {
    expect(render(DEFAULT_PLACE_FILTERS, { compact: true })).toContain('drop-shadow')
    expect(render()).not.toContain('drop-shadow')
  })

  /*
    **지도 갈래는 오버레이와 좌측 패널을 둘 다 렌더하고 CSS 로만 감춘다.** 같은 `id` 가
    둘이면 `htmlFor` 가 어느 입력을 가리키는지 문서가 정하지 못한다.
  */
  it('id 를 받아 한 문서에 여러 벌이 설 수 있다', () => {
    const markup = render(DEFAULT_PLACE_FILTERS, { id: 'place-keyword-map' })

    expect(markup).toContain('id="place-keyword-map"')
    expect(markup).toContain('for="place-keyword-map"')
    expect(markup).not.toContain('"place-keyword"')
  })

  /*
    **목록 갈래의 인셋은 기본값으로 남는다** (#531). `className` 을 넘기면 담는 곳이 자기
    면에 맞는 값을 이미 정한 것이라, 카드 인셋이 따라붙으면 두 번 밀린다.
  */
  it('className 을 넘기지 않으면 목록 갈래의 카드 인셋을, 넘기면 그것만 쓴다', () => {
    // 기본 — `SurfaceStack` 직속이라 폼이 자기 인셋을 든다 (#531)
    expect(render()).toContain('pt-3 px-4 md:px-5')

    // 담는 곳이 정했으면 그것만 — 카드 인셋이 따라붙으면 지도 위에서 두 번 밀린다
    const overlay = render(DEFAULT_PLACE_FILTERS, {
      compact: true,
      id: 'place-keyword-map',
      className: 'pointer-events-auto min-w-0 max-w-md flex-1 lg:hidden',
    })
    expect(overlay).not.toContain('pt-3 px-4 md:px-5')
  })
})
