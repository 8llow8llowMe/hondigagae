import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { IndoorAlternativesSection } from '@/features/home/indoor-alternatives-section'
import { messages } from '@/lib/messages'
import { suitabilityWithIndoor } from '@/test/fixtures/insight'
import type { AlternativePlaceItem } from '@/types/insight'

const ALTERNATIVE = suitabilityWithIndoor.indoorAlternatives[0] as AlternativePlaceItem

function render(alternatives: AlternativePlaceItem[]) {
  return renderToStaticMarkup(createElement(IndoorAlternativesSection, { alternatives }))
}

describe('IndoorAlternativesSection', () => {
  /*
    비가 안 오는 날은 대안이 필요 없다. 제목만 남으면 "대안이 없다" 로 읽히는데 사실은
    필요가 없는 것이다 — 일정 상세의 같은 블록과 같은 판단이다.
  */
  it('대안이 없으면 아무것도 그리지 않는다', () => {
    expect(render([])).toBe('')
  })

  it('장소명과 실내 제목을 그린다', () => {
    const markup = render([ALTERNATIVE])

    expect(markup).toContain(messages.home.indoorHeading)
    expect(markup).toContain('제주현대미술관')
  })

  /* 거리의 기준점을 말하지 않으면 무엇으로부터의 거리인지 알 수 없다 */
  it('거리에 `직선` 을 붙이고 기준을 밝힌다', () => {
    const markup = render([ALTERNATIVE])

    expect(markup).toContain('직선 2.3km')
    expect(markup).toContain(messages.home.indoorNote)
  })

  /* 실내라도 들어갈 수 있는지가 첫 질문이다 — 동반 조건은 서버 `name` 그대로 */
  it('동반 조건과 동반 가능 크기를 서버 문구로 그린다', () => {
    const markup = render([ALTERNATIVE])

    expect(markup).toContain('부분 동반 가능')
    expect(markup).toContain('소형견')
  })

  it('장소 상세로 보낸다', () => {
    expect(render([ALTERNATIVE])).toContain(`href="/places/${ALTERNATIVE.placeId}"`)
  })
})
