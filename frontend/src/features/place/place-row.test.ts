import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceRow } from '@/features/place/place-row'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

function render(place = placeSummary, last = false) {
  return renderToStaticMarkup(createElement(PlaceRow, { place, last }))
}

describe('PlaceRow — 서버 metadata 렌더', () => {
  it('제목과 서버 metadata name 을 그대로 쓴다', () => {
    const markup = render()

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('부분 동반 가능')
    expect(markup).toContain('관광지')
  })

  it('동반 가능 여부에 등급 색을 쓰지 않는다 (DESIGN.md §2-3)', () => {
    const markup = render()

    // 태그는 전부 중립(band)이다. metric-* tint 가 행에 새어들면 안 된다.
    expect(markup).not.toContain('metric-high')
    expect(markup).not.toContain('metric-mid')
    expect(markup).not.toContain('metric-critical')
  })

  it('목록 API 가 점수를 주지 않으므로 적합도 숫자를 그리지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('/100')
  })
})

describe('PlaceRow — 표면 (DESIGN.md §0)', () => {
  it('카드가 아니라 행이다 — 라운드·그림자를 쓰지 않는다', () => {
    const markup = render()

    expect(markup).not.toContain('rounded-lg')
    expect(markup).not.toContain('shadow')
  })

  it('마지막 행이 아니면 구분선을 그린다', () => {
    expect(render(placeSummary, false)).toContain('border-b')
  })

  it('마지막 행에는 구분선을 그리지 않는다', () => {
    expect(render(placeSummary, true)).not.toContain('border-b')
  })
})

describe('PlaceRow — nullable 처리', () => {
  it('firstImage 가 null 이면 같은 크기의 "이미지 없음" 타일을 남긴다', () => {
    const markup = render({ ...placeSummary, firstImage: null })

    expect(markup).toContain(messages.place.noImage)
    // 행 높이가 흔들리지 않도록 타일 크기는 그대로다
    expect(markup).toContain('h-20 w-20')
  })

  it('addr1 이 null 이면 주소 줄 자체를 렌더하지 않는다', () => {
    const markup = render({ ...placeSummary, addr1: null })

    expect(markup).not.toContain('제주특별자치도 제주시')
  })
})

describe('PlaceRow — 링크', () => {
  it('행 전체가 상세로 가는 링크다', () => {
    const markup = render()

    expect(markup).toContain(`href="/places/${placeSummary.placeId}"`)
  })

  it('중첩 링크를 만들지 않는다 — 행 안에 a 는 하나뿐이다', () => {
    const markup = render()

    expect(markup.match(/<a /g)).toHaveLength(1)
  })
})
