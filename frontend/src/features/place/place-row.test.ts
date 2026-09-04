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

describe('PlaceRow — 메타 줄 (아트보드 01·03)', () => {
  it('주소를 읍·면·동까지 줄이고 실내/야외를 붙인다', () => {
    const markup = render()

    // fixture 의 addr1 은 `제주특별자치도 제주시 한림읍 용금로 906-107` 이다
    expect(markup).toContain('제주시 한림읍 · 실내')
    expect(markup).not.toContain('용금로')
  })

  it('indoor 가 false 면 야외로 쓴다', () => {
    expect(render({ ...placeSummary, indoor: false })).toContain(
      `한림읍 · ${messages.place.rowOutdoor}`,
    )
  })

  it('아트보드의 거리(4.1km)는 목록 응답에 없으므로 그리지 않는다', () => {
    expect(render()).not.toContain('km')
  })
})

describe('PlaceRow — nullable 처리', () => {
  /*
    **사진 없는 장소가 대부분이다** — dev 실측(제주 400건) 281건(70%). 그래서 그 자리를
    카테고리 일러스트가 채운다 (`lib/place/illustration.ts`). 어느 갈래든 **타일 크기는
    그대로**여서 행 높이가 흔들리지 않는다.
  */
  it('firstImage 가 null 이면 카테고리 일러스트로 같은 크기의 타일을 채운다', () => {
    const markup = render({ ...placeSummary, firstImage: null })

    expect(markup).toContain('/illustrations/place-tourist_spot.svg')
    // 장식이므로 이름을 읽히지 않는다 — 카테고리는 배지가 낱말로 말한다
    expect(markup).toContain('alt=""')
    expect(markup).toContain('size-20')
  })

  it('자산이 없는 카테고리는 "이미지 없음" 타일로 떨어진다 — 카테고리를 지어내지 않는다', () => {
    const markup = render({
      ...placeSummary,
      firstImage: null,
      contentType: { code: 'FESTIVAL', name: '축제·공연', description: null },
    })

    expect(markup).toContain(messages.place.noImage)
    expect(markup).not.toContain('/illustrations/')
    expect(markup).toContain('size-20')
  })

  it('addr1 이 null 이면 주소를 빼고 실내/야외만 남긴다', () => {
    const markup = render({ ...placeSummary, addr1: null })

    expect(markup).not.toContain('제주시 한림읍')
    expect(markup).toContain(messages.place.rowIndoor)
  })

  it('addr1 · indoor 가 모두 없으면 메타 줄 자체를 렌더하지 않는다', () => {
    const markup = render({ ...placeSummary, addr1: null, indoor: null })

    expect(markup).not.toContain('tabular-nums')
  })

  it('indoor 가 null 이면 "모름" 을 점선 배지로 드러낸다', () => {
    const markup = render({ ...placeSummary, indoor: null })

    expect(markup).toContain(messages.place.rowIndoorUnknown)
    expect(markup).toContain('border-dashed')
  })

  it('indoor 를 아는 장소에는 점선 배지를 붙이지 않는다', () => {
    expect(render()).not.toContain('border-dashed')
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
