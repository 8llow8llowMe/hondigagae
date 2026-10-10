import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { FavoritePlaceRow } from '@/features/favorite/favorite-place-row'
import { type Inset, INSET_CLASS } from '@/lib/ui/inset'
import { favoritePlaceItem } from '@/test/fixtures/favorite'

function render(inset?: Inset) {
  return renderToStaticMarkup(
    createElement(FavoritePlaceRow, {
      item: favoritePlaceItem(),
      ...(inset === undefined ? {} : { inset }),
      unsaved: false,
      pending: false,
      disabled: false,
      error: null,
      index: 0,
      onToggle: () => undefined,
    }),
  )
}

/** 행 자신의 class 만 뽑는다 — 안쪽 래퍼·버튼의 테두리와 섞이지 않게 한다 */
function rowClass(markup: string) {
  return /^<li class="([^"]*)"/.exec(markup)?.[1] ?? ''
}

describe('FavoritePlaceRow — L2 항목 (DESIGN.md §0, #462)', () => {
  it('li 로 나온다 — 구분선을 긋는 SurfaceList 의 항목이다', () => {
    expect(render()).toMatch(/^<li /)
  })

  it('자기 테두리를 두르지 않는다 — 아이템과 섹션이 같은 채널을 쓰면 둘 다 죽는다', () => {
    /*
      2a 때는 `Row` 의 안쪽 래퍼가 `border-b` 를 긋고 `last`·`lastGridRow`·
      `columnDivider` 가 그것을 껐다 켰다 했다. 이제 행은 인셋만 갖는다.
    */
    expect(rowClass(render())).toBe('px-4 md:px-5')
  })

  it('기본 인셋은 카드 안(16/20)이다 — 3a 가 정본이라 카드가 기본 자리다', () => {
    expect(rowClass(render())).toBe(rowClass(render('card')))
  })

  it('인셋 값은 담는 곳이 정한다 — 행이 리터럴로 박지 않는다', () => {
    /*
      지금 이 행의 호출처는 카드 안 하나뿐이다. prop 을 두는 것은 L2 규약
      (`PlaceRow` · `FacilityRow` 와 같은 계약)을 지키기 위해서지 **쓰이지 않는 화면을
      예상해서가 아니다** — 값이 `INSET_CLASS` 를 거쳐 나오는지만 본다.
    */
    expect(rowClass(render('main'))).toBe(INSET_CLASS.main)
    expect(rowClass(render('card'))).toBe(INSET_CLASS.card)
  })
})
