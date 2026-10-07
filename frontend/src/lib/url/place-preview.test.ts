import { describe, expect, it } from 'vitest'

import {
  PLACE_PREVIEW_KEY,
  placePreviewHistoryAction,
  placePreviewHref,
  readPlacePreview,
  readPlacePreviewParam,
} from './place-preview'

describe('readPlacePreview', () => {
  it('유효한 장소 id 를 읽는다', () => {
    expect(readPlacePreview(new URLSearchParams('view=map&place=126434'))).toBe('126434')
  })

  it('없거나 장소 id 모양이 아니면 null — 손으로 만든 주소가 조회를 쏘지 않는다', () => {
    expect(readPlacePreview(new URLSearchParams('view=map'))).toBeNull()
    expect(readPlacePreview(new URLSearchParams('place='))).toBeNull()
    expect(readPlacePreview(new URLSearchParams('place=../etc'))).toBeNull()
  })
})

describe('placePreviewHref', () => {
  it('다른 쿼리(필터 · 보기)를 그대로 두고 place 만 붙인다', () => {
    expect(placePreviewHref('/places?view=map&indoor=true', '126434')).toBe(
      '/places?view=map&indoor=true&place=126434',
    )
  })

  it('이미 있으면 바꾼다', () => {
    expect(placePreviewHref('/places?place=1&view=map', '2')).toBe('/places?place=2&view=map')
  })

  it('null 이면 place 만 지운다 — 쿼리가 비면 물음표도 없다', () => {
    expect(placePreviewHref('/places?view=map&place=1', null)).toBe('/places?view=map')
    expect(placePreviewHref('/places?place=1', null)).toBe('/places')
  })

  it('해시를 보존한다', () => {
    expect(placePreviewHref('/places?view=map#x', '3')).toBe('/places?view=map&place=3#x')
  })

  it('키 이름은 place 다 — 명세 · 이슈와 같은 이름', () => {
    expect(PLACE_PREVIEW_KEY).toBe('place')
  })
})

describe('readPlacePreviewParam — 서버 페이지 레코드', () => {
  it('문자열 하나만 읽는다', () => {
    expect(readPlacePreviewParam('126434')).toBe('126434')
    expect(readPlacePreviewParam(['1', '2'])).toBeNull()
    expect(readPlacePreviewParam(undefined)).toBeNull()
    expect(readPlacePreviewParam('abc')).toBeNull()
  })
})

describe('placePreviewHistoryAction', () => {
  const act = (currentId: string | null, placeId: string | null, pushed: boolean) =>
    placePreviewHistoryAction({ currentId, placeId, pushed })

  it('처음 열기는 push, 다른 장소는 replace, 같은 장소는 none', () => {
    expect(act(null, '1', false)).toBe('push')
    expect(act('1', '2', true)).toBe('replace')
    expect(act('1', '1', true)).toBe('none')
  })

  it('쌓은 칸에서 닫으면 back — 뒤로가기와 ✕ 가 같은 일을 한다', () => {
    expect(act('1', null, true)).toBe('back')
  })

  it('공유 링크로 들어온 칸에서 닫으면 replace — back 하면 화면을 떠난다', () => {
    expect(act('1', null, false)).toBe('replace')
  })

  it('이미 닫혀 있으면 none', () => {
    expect(act(null, null, true)).toBe('none')
  })
})
