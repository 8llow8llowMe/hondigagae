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

  /*
    **링크 안에 버튼을 넣지 않는다** (#913). 예전 `<Link><Button/></Link>` 는 `<a><button>` 이라
    같은 행동에 탭 정지가 둘이었고 스크린리더가 링크·버튼을 따로 읽었다.
  */
  it('빈 목록의 CTA 는 링크 하나다 — a 안에 button 이 없다', () => {
    const markup = render({ places: [], totalCount: 0 })
    const at = markup.indexOf(messages.favorite.emptyAction)
    const anchor = markup.slice(markup.lastIndexOf('<a', at), markup.indexOf('</a>', at))

    expect(at).toBeGreaterThan(-1)
    expect(anchor).toContain('href="/places"')
    expect(anchor).not.toContain('<button')
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
    expect(markup).toContain(messages.favorite.limitReachedDescription)
    // 상태는 개수와 배지가 이미 두 번 말했다 — 문장은 할 일만 맡는다 (§1, #462)
    expect(markup).not.toContain('저장 칸이 가득 찼어요')
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

describe('FavoriteListSection — 3층 표면 (DESIGN.md §0, #462)', () => {
  /*
    이 화면의 카드는 하나이고, **개수가 응답에서 오므로 카드를 이 컴포넌트가 그린다**
    (#461 브리핑과 같은 판단). 페이지는 바닥과 `sr-only` h1 만 맡는다.
  */
  it('카드 하나로 그린다 — Surface 를 쓴다', () => {
    /*
      **L1 의 외형은 여기서 단언하지 않는다.** radius·테두리 클래스 문자열은
      `surface.tsx` 의 것이고 `surface.test.ts` · `token-usage.test.ts`(FLOATING)가 이미
      소유한다 — 여기서 다시 적으면 프리미티브의 클래스 순서만 바뀌어도 이 화면 테스트가
      깨진다(원인은 `surface.tsx` 인데 빨간불은 favorite 에 뜬다).
    */
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).toMatch(/^<section [^>]*aria-labelledby="favorite-list-heading"/)
    // 카드가 하나다 — 목록·상태·AI 안내가 전부 그 안이다
    expect(markup.match(/<section/g)).toHaveLength(1)
  })

  it('제목이 카드 안 h2 다 — h1 은 페이지가 sr-only 로 갖는다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).toContain('<h2 id="favorite-list-heading"')
    expect(markup).toContain(messages.favorite.listTitle)
    expect(markup).not.toContain('<h1')
  })

  it('2열 규약을 행이 아니라 목록이 갖는다', () => {
    /*
      2a 때는 행이 `last`·`lastGridRow`·`columnDivider` 세 prop 으로 스스로 선을 그었다.
      이제 `SurfaceList columns={2}` 가 `.surface-list-2col`(globals.css) 하나로 맡는다 —
      첫 시각적 행의 오른쪽 칸 위선과 열 사이 세로선이 그 안에 있다.
    */
    const markup = render({
      places: [favoritePlaceItem(), favoritePlaceItem({ placeId: 'b', title: '제주현대미술관' })],
      totalCount: 2,
    })

    expect(markup).toContain('surface-list-2col')
    expect(markup).toContain('[&amp;&gt;li+li]:border-t')
  })

  it('행은 인셋만 갖는다 — 2a 의 세 prop 이 마크업에서 사라졌다', () => {
    const markup = render({
      places: [favoritePlaceItem(), favoritePlaceItem({ placeId: 'b', title: '제주현대미술관' })],
      totalCount: 2,
    })

    /*
      `not.toContain('border-b')` 로는 못 잡는다 — `border-border` 안에 그 문자열이
      들어 있어 항상 걸린다(여기서 실제로 걸렸다). 행의 class 만 뽑아 **인셋 말고는
      아무것도 없다**를 단언한다.
    */
    const rowClasses = [...markup.matchAll(/<li class="([^"]*)"/g)].map(([, value]) => value)

    expect(rowClasses).toEqual(['px-4 md:px-5', 'px-4 md:px-5'])
  })

  it('네 상태가 모두 카드 인셋(16/20)에 선다', () => {
    /*
      상태마다 축이 다르면 목록이 바뀌는 순간 왼쪽 선이 뛴다 (#451). 페이지 인셋 40 을
      카드 안에서 쓰면 내용이 두 번 밀린다 (§0).
    */
    const CARD_INSET = 'px-4 md:px-5'

    expect(render({ loading: true })).toContain(CARD_INSET)
    expect(render({ errorStatus: 500 })).toContain(CARD_INSET)
    expect(render({ places: [], totalCount: 0 })).toContain(CARD_INSET)
    expect(render({ places: [favoritePlaceItem()], totalCount: 1 })).toContain(CARD_INSET)

    // 페이지 인셋(40)이 카드 안에 남아 있지 않다
    expect(render({ places: [favoritePlaceItem()], totalCount: 1 })).not.toContain('md:px-10')
  })

  it('스켈레톤도 같은 목록 규약을 쓴다 — 로딩이 끝날 때 선이 새로 생기지 않는다', () => {
    const markup = render({ loading: true })

    expect(markup).toContain('surface-list-2col')
    expect(markup).toContain('aria-busy="true"')
  })

  it('AI 안내는 카드 안 마지막 블록이고 위에 1px 선을 둔다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).toContain(messages.favorite.aiHint)
    expect(markup).toContain('border-t py-4')
  })
})

describe('FavoriteListSection — 개수 줄은 셀 수 있을 때만 (#462)', () => {
  /*
    로딩 중에는 아직 모르고(`0/100곳` 은 거짓말이다), 오류에는 셀 수 없으며, 0건에는
    `EmptyState` 가 같은 말을 이미 한다.
  */
  it('로딩 중에는 개수를 말하지 않는다', () => {
    const markup = render({ loading: true })

    expect(markup).not.toContain(messages.favorite.sortFixed)
    expect(markup).not.toContain('/100곳')
  })

  it('오류에는 개수를 말하지 않는다', () => {
    const markup = render({ errorStatus: 500 })

    expect(markup).not.toContain('/100곳')
  })

  it('0건에는 개수를 말하지 않는다 — 빈 화면에 숫자만 두 줄 는다', () => {
    const markup = render({ places: [], totalCount: 0 })

    expect(markup).toContain(messages.favorite.emptyTitle)
    expect(markup).not.toContain('0/100곳')
    expect(markup).not.toContain('100곳 더 저장할 수 있어요')
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

describe('FavoriteListSection — AI 일정 안내 (명세 D8-1 · #408)', () => {
  /*
    아트보드 01 하단의 안내다. AI 일정 조건 입력에는 `preferFavoritesLink` 로 이리 오는
    길이 있는데 되돌아가는 길이 없었다 — #127 때는 토글이 없어 비웠고, #128 이 토글을
    만든 뒤에도 문구만 남아 있었다.
  */
  it('목록이 있으면 AI 일정 조건 입력으로 가는 길을 낸다', () => {
    const markup = render({ places: [favoritePlaceItem()], totalCount: 1 })

    expect(markup).toContain(messages.favorite.aiHint)
    expect(markup).toContain('href="/ai-plans/new"')
    expect(markup).toContain(messages.favorite.aiHintAction)
  })

  it('토글 이름을 그대로 인용한다 — 갈리면 사용자가 그 컨트롤을 못 찾는다', () => {
    expect(messages.favorite.aiHint).toContain(messages.aiPlan.preferFavoritesLabel)
  })

  it('빈 목록에는 내지 않는다 — 후보가 없는데 먼저 넣기를 권하지 않는다', () => {
    const markup = render({ places: [], totalCount: 0 })

    expect(markup).not.toContain(messages.favorite.aiHint)
    expect(markup).not.toContain('href="/ai-plans/new"')
  })
})
