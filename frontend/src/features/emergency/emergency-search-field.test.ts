import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it, vi } from 'vitest'

import { EmergencySearchField } from '@/features/emergency/emergency-search-field'
import { messages } from '@/lib/messages'
import { KEYWORD_MAX_LENGTH } from '@/lib/url/keyword'
import { DEFAULT_FACILITY_FILTERS, type FacilityFilters } from '@/types/emergency'

/**
 * 시설명 · 주소 검색 입력 (#584).
 *
 * **제출 → URL → 재조회 사슬은 e2e 가 잰다** (`e2e/emergency-search.spec.ts`) — 폼 제출도
 * `router.replace` 도 실제 브라우저에서만 일어난다. 여기서 잠그는 것은 **마크업**이다:
 * 랜드마크 · 라벨 · 상한 · 초기값 넷은 조용히 깨지고, 깨져도 화면은 멀쩡해 보인다.
 */
function render(
  filters: FacilityFilters = DEFAULT_FACILITY_FILTERS,
  extra: { compact?: boolean; id?: string } = {},
) {
  return renderToStaticMarkup(
    createElement(EmergencySearchField, { filters, onFiltersChange: vi.fn(), ...extra }),
  )
}

describe('EmergencySearchField', () => {
  /* 보조기기가 이 구간을 이름으로 찾는다. `/places` 와 이름이 달라야 한다 — 화자가 다르다 */
  it('search 랜드마크와 접근성 이름을 낸다', () => {
    const markup = render()

    expect(markup).toContain('role="search"')
    expect(markup).toContain('시설 이름·주소로 찾기')
    expect(markup).not.toContain('장소 이름·주소로 찾기')
  })

  /* 라벨이 입력과 이어져야 스크린리더가 무엇을 치는 칸인지 말한다 */
  it('sr-only 라벨이 입력을 가리킨다', () => {
    const markup = render()

    expect(markup).toContain('for="emergency-keyword"')
    expect(markup).toContain('id="emergency-keyword"')
  })

  /*
    `type="search"` 는 모바일 키보드의 `검색` 키와 브라우저 비우기 버튼을 부른다.
    `maxLength` 는 `/places` 와 같은 상수라 붙여넣기까지 막힌다.
  */
  it('검색 입력 문법과 길이 상한을 쓴다', () => {
    const markup = render()

    expect(markup).toContain('type="search"')
    expect(markup).toContain(`maxLength="${String(KEYWORD_MAX_LENGTH)}"`)
  })

  /* URL 이 조건이라, 주소로 바로 들어와도 입력이 그 값을 들고 있어야 한다 */
  it('URL 의 검색어를 초기값으로 쓴다', () => {
    expect(render({ ...DEFAULT_FACILITY_FILTERS, keyword: '한라' })).toContain('value="한라"')
  })
})

/**
 * 지도 위 오버레이 변형 — 375 실측으로 입력에 193px 밖에 없다
 * (토글 90 · 좌우 여백 16×2 · 아이콘 버튼 44 · 간격). 글자 버튼이면 177 로 줄어
 * placeholder 가 잘리고, **잘린 문구는 짧은 문구보다 나쁘다.**
 */
describe('EmergencySearchField — compact (지도 오버레이)', () => {
  it('제출 버튼이 글자 대신 아이콘이고 이름은 그대로 검색이다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS, { compact: true })

    expect(markup).toContain('aria-label="검색"')
    // 글자 `검색` 버튼은 사라진다 — 라벨은 `aria-label` 로만 남는다
    expect(markup).not.toContain('>검색</button>')
    expect(markup).toContain('<svg')
  })

  it('짧은 placeholder 를 쓴다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS, { compact: true })

    expect(markup).toContain(messages.emergency.searchPlaceholderShort)
    expect(markup).not.toContain(messages.emergency.searchPlaceholder)
  })

  /*
    같은 줄의 보기 토글·내 위치 버튼이 `shadow-md` 다. `box-shadow` 가 아니라 `drop-shadow`
    인 것이 핵심 — 배경 없는 `flex gap-2` 폼이라 `shadow-md` 면 입력과 버튼 **사이 틈까지**
    한 덩어리로 깔린다.
  */
  it('지도 위에서 뜨도록 drop-shadow 를 건다 — 카드 안 변형에는 없다', () => {
    expect(render(DEFAULT_FACILITY_FILTERS, { compact: true })).toContain('drop-shadow')
    expect(render()).not.toContain('drop-shadow')
  })

  /*
    **지도 갈래는 오버레이와 좌측 패널을 둘 다 렌더하고 CSS 로만 감춘다.** 같은 `id` 가
    둘이면 `htmlFor` 가 어느 입력을 가리키는지 문서가 정하지 못한다.
  */
  it('id 를 받아 한 문서에 두 벌이 설 수 있다', () => {
    const markup = render(DEFAULT_FACILITY_FILTERS, { id: 'emergency-keyword-map' })

    expect(markup).toContain('id="emergency-keyword-map"')
    expect(markup).toContain('for="emergency-keyword-map"')
    expect(markup).not.toContain('"emergency-keyword"')
  })
})
