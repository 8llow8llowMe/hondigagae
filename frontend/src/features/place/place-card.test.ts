import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceCard } from '@/features/place/place-card'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

describe('PlaceCard — 서버 metadata 렌더', () => {
  it('서버가 준 enum name 을 그대로 렌더한다 (FE 매핑 테이블을 쓰지 않는다)', () => {
    const markup = renderToStaticMarkup(createElement(PlaceCard, { place: placeSummary }))

    expect(markup).toContain('관광지')
    expect(markup).toContain('부분 동반 가능')
  })

  it('모르는 petAllowanceType code 에서도 서버 name 이 보이고 화면이 비지 않는다', () => {
    const place = {
      ...placeSummary,
      petAllowanceType: { code: 'FUTURE_CODE', name: '새 등급', description: null },
    }

    const markup = renderToStaticMarkup(createElement(PlaceCard, { place }))

    expect(markup).toContain('새 등급')
  })
})

describe('PlaceCard — nullable 처리', () => {
  it('이미지가 없으면 에러가 아니라 플레이스홀더를 보여준다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceCard, { place: { ...placeSummary, firstImage: null } }),
    )

    expect(markup).toContain(messages.place.noImage)
  })

  it('주소가 없으면 주소 줄을 숨긴다', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaceCard, { place: { ...placeSummary, addr1: null } }),
    )

    expect(markup).not.toContain('제주특별자치도 제주시')
  })

  it('전화번호가 없으면 전화 줄을 숨긴다', () => {
    const withTel = renderToStaticMarkup(
      createElement(PlaceCard, { place: { ...placeSummary, tel: '064-760-6331' } }),
    )
    const withoutTel = renderToStaticMarkup(createElement(PlaceCard, { place: placeSummary }))

    expect(withTel).toContain('064-760-6331')
    expect(withoutTel).not.toContain('064-760-6331')
  })
})

describe('PlaceCard — 링크', () => {
  it('문자열 placeId 를 그대로 상세 경로에 쓴다 (정밀도 손상 없음)', () => {
    const markup = renderToStaticMarkup(createElement(PlaceCard, { place: placeSummary }))

    expect(markup).toContain('/places/212481712381923328')
  })

  it('긴 한국어 장소명을 그대로 렌더한다', () => {
    const markup = renderToStaticMarkup(createElement(PlaceCard, { place: placeSummary }))

    expect(markup).toContain('제주특별자치도립김창열미술관')
    expect(markup).toContain('line-clamp-2')
  })
})
