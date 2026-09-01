import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  FavoriteListSection,
  type FavoriteListSectionProps,
} from '@/features/favorite/favorite-list-section'
import { MAX_FAVORITE_COUNT } from '@/lib/api/favorite'
import { messages } from '@/lib/messages'
import { favoritePlaceItem, favoritePlaceItemWithoutSummary } from '@/test/fixtures/favorite'

function render(overrides: Partial<FavoriteListSectionProps> = {}) {
  const props: FavoriteListSectionProps = {
    places: [],
    totalCount: 0,
    loading: false,
    errorStatus: null,
    unsaved: new Set(),
    pendingId: null,
    errors: new Map(),
    onRetry: () => undefined,
    onToggle: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(FavoriteListSection, props))
}

describe('FavoriteListSection — 상태 배타성 (명세 D5)', () => {
  it('로딩 중에는 skeleton 만 보이고 목록이 함께 나오지 않는다', () => {
    const item = favoritePlaceItem()
    const markup = render({ loading: true, places: [item], totalCount: 1 })

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain(item.title as string)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('빈 목록에는 재시도 버튼을 붙이지 않는다 — 데이터 부재는 장애가 아니다', () => {
    const markup = render({ places: [], totalCount: 0 })

    expect(markup).toContain(messages.favorite.emptyTitle)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('빈 목록은 장소 찾기로 보낸다', () => {
    const markup = render({ places: [], totalCount: 0 })

    expect(markup).toContain(messages.favorite.emptyAction)
    expect(markup).toContain('href="/places"')
  })

  it('5xx 는 재시도 버튼과 함께 낸다 — 저장이 남아 있다고 말한다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).toContain(messages.favorite.loadFailedTitle)
    expect(markup).toContain(messages.favorite.loadFailedDescription)
    expect(markup).toContain(messages.common.retry)
  })

  it('오류일 때 목록을 함께 그리지 않는다', () => {
    const item = favoritePlaceItem()
    const markup = render({ errorStatus: 500, places: [item], totalCount: 1 })

    expect(markup).not.toContain(item.title as string)
  })
})

describe('FavoriteListSection — 헤더 (아트보드 01)', () => {
  it('순서가 무엇인지 글자로 적는다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 12 })

    expect(markup).toContain(messages.favorite.sortFixed)
  })

  it('상한을 미리 말한다 — 12/100곳', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 12 })

    expect(markup).toContain('12/100곳')
  })

  it('상한 전에는 남은 여유를 상시 표기한다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 12 })

    expect(markup).toContain('88곳 더 저장할 수 있어요')
    expect(markup).not.toContain(messages.favorite.limitReachedBadge)
  })

  it('상한에 닿으면 배지와 이유를 함께 내고 목록은 그대로 그린다', () => {
    const item = favoritePlaceItem()
    const markup = render({ places: [item], totalCount: MAX_FAVORITE_COUNT })

    expect(markup).toContain(messages.favorite.limitReachedBadge)
    expect(markup).toContain('저장 칸이 가득 찼어요(100곳)')
    // 상한이라고 목록을 숨기지 않는다 — 여기서 해제해야 새로 저장할 수 있다
    expect(markup).toContain(item.title as string)
  })
})

describe('FavoriteListSection — 정렬 컨트롤 없음 (회귀 감시, 아트보드 01)', () => {
  /*
    응답이 최근 저장순 하나뿐이다. 컨트롤을 두면 있지도 않은 선택지를 약속하게 되고,
    클라이언트 정렬은 100곳 중 화면에 온 만큼만 정렬돼 **틀린 순서**가 된다.
  */
  it('select·정렬 버튼을 렌더하지 않는다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 12 })

    expect(markup).not.toContain('<select')
    expect(markup).not.toContain('이름순')
    expect(markup).not.toContain('거리순')
  })
})

describe('FavoriteListSection — 2열 그리드 구분선 (아트보드 03)', () => {
  /** `xl:border-e` 가 열 사이 1px 선이다 */
  const COLUMN_DIVIDER = 'xl:border-e'

  it('오른쪽에 짝이 없으면 열 구분선을 긋지 않는다 — 빈 공간 옆에 선만 남는다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).not.toContain(COLUMN_DIVIDER)
  })

  it('짝이 있으면 왼쪽 칸이 구분선을 맡는다', () => {
    const markup = render({
      places: [favoritePlaceItem(), favoritePlaceItem({ placeId: 'b', title: '제주현대미술관' })],
      totalCount: 2,
    })

    expect(markup).toContain(COLUMN_DIVIDER)
  })
})

describe('FavoriteListSection — 요약 없는 행 (명세 D5)', () => {
  it('title 이 null 인 행을 감추지 않는다', () => {
    const item = favoritePlaceItemWithoutSummary()
    const markup = render({ places: [item], totalCount: 1 })

    expect(markup).toContain(messages.favorite.missingTitle)
    expect(markup).toContain(`장소 번호 ${item.placeId}`)
  })

  it('요약 없는 행에도 상세로 갈 길을 준다', () => {
    const item = favoritePlaceItemWithoutSummary()
    const markup = render({ places: [item], totalCount: 1 })

    expect(markup).toContain(messages.favorite.missingTitleAction)
    expect(markup).toContain(`href="/places/${item.placeId}"`)
  })

  it('요약이 있는 행과 없는 행이 섞여도 둘 다 남는다', () => {
    const withSummary = favoritePlaceItem()
    const without = favoritePlaceItemWithoutSummary()
    const markup = render({ places: [withSummary, without], totalCount: 2 })

    expect(markup).toContain(withSummary.title as string)
    expect(markup).toContain(messages.favorite.missingTitle)
  })
})

describe('FavoriteListSection — 해제 상태 (명세 D4)', () => {
  it('해제한 행이 사라지지 않고 버튼만 저장으로 돌아간다', () => {
    const item = favoritePlaceItem()
    const markup = render({
      places: [item],
      totalCount: 1,
      unsaved: new Set([item.placeId]),
    })

    // 행이 남는다 — 실수로 지운 것을 그 자리에서 되살릴 수 있어야 한다
    expect(markup).toContain(item.title as string)
    /*
      아이콘만 빈 상태로 바뀐다 (아트보드 01). 같은 버튼이 되돌리기를 겸하므로 undo
      토스트를 만들지 않는다 — 라벨과 `aria-pressed` 가 함께 뒤집힌다.
    */
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain(`aria-label="${item.title} ${messages.favorite.save}"`)
    expect(markup).toContain('fill="none"')
  })

  it('해제 실패는 그 행에 남긴다 — 화면 위쪽에 모으지 않는다', () => {
    const item = favoritePlaceItem()
    const markup = render({
      places: [item],
      totalCount: 1,
      errors: new Map([[item.placeId, messages.favorite.errorDescription]]),
    })

    expect(markup).toContain(messages.favorite.errorDescription)
  })

  it('한 행이 처리 중이면 다른 행의 버튼을 막는다 — 무효화 순서가 꼬인다', () => {
    const first = favoritePlaceItem()
    const second = favoritePlaceItem({ placeId: '212481712381923777', title: '제주현대미술관' })
    const markup = render({
      places: [first, second],
      totalCount: 2,
      pendingId: first.placeId,
    })

    expect(markup).toContain('disabled')
  })
})

describe('FavoriteListSection — 접근성 (명세 D6)', () => {
  it('아이콘 버튼의 이름에 장소명이 들어간다 — 어느 행인지 알아야 한다', () => {
    const item = favoritePlaceItem()
    const markup = render({ places: [item], totalCount: 1 })

    expect(markup).toContain(`aria-label="${item.title} ${messages.favorite.unsave}"`)
  })

  it('저장된 상태를 aria-pressed 로 말한다 — 아이콘 채움만으로는 알 수 없다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).toContain('aria-pressed="true"')
  })

  it('요약 없는 행은 장소명이 없어 라벨이 "저장 해제" 로만 남는다', () => {
    const item = favoritePlaceItemWithoutSummary()
    const markup = render({ places: [item], totalCount: 1 })

    expect(markup).toContain(`aria-label="${messages.favorite.unsave}"`)
  })

  it('제목이 링크다 — 행 전체를 감싸면 안에 버튼을 넣을 수 없다', () => {
    const item = favoritePlaceItem()
    const markup = render({ places: [item], totalCount: 1 })

    expect(markup).toContain(`href="/places/${item.placeId}"`)
    expect(markup).toContain('<button')
  })
})

describe('FavoriteListSection — 저장일 (명세 D9-1)', () => {
  /*
    아트보드 03 은 행마다 `2026-08-30 저장` 을 표시하지만 `FavoritePlaceItem` 에 날짜
    필드가 없다. 없는 값을 만들지 않는다 — BE 가 필드를 주면 이 테스트를 지운다.
  */
  it('저장일 자리를 만들지 않는다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).not.toContain('저장일')
    expect(markup).not.toMatch(/\d{4}-\d{2}-\d{2} 저장/)
  })
})
