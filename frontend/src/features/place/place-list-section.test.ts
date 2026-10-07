import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import {
  PLACE_PRIORITY_ROW_COUNT,
  PlaceListSection,
  type PlaceListSectionProps,
} from '@/features/place/place-list-section'
import { messages } from '@/lib/messages'
import { placeSummary } from '@/test/fixtures/place'

function render(overrides: Partial<PlaceListSectionProps> = {}) {
  const props: PlaceListSectionProps = {
    places: [],
    loading: false,
    errorStatus: null,
    hasNext: false,
    loadingMore: false,
    onLoadMore: () => undefined,
    onRetry: () => undefined,
    onResetFilters: () => undefined,
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlaceListSection, props))
}

describe('PlaceListSection — 상태 배타성', () => {
  it('로딩 중에는 skeleton 만 보이고 목록·에러가 함께 나오지 않는다', () => {
    const markup = render({ loading: true, places: [placeSummary] })

    expect(markup).toContain('animate-pulse')
    expect(markup).not.toContain(placeSummary.title)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('성공 시 목록을 렌더한다', () => {
    const markup = render({ places: [placeSummary] })

    expect(markup).toContain(placeSummary.title)
    expect(markup).not.toContain(messages.place.emptyTitle)
  })
})

describe('PlaceListSection — 에러 분기', () => {
  it('데이터 부재(404)에서는 재시도 버튼을 노출하지 않는다', () => {
    const markup = render({ errorStatus: 404, errorMessage: '조건에 맞는 장소가 없습니다.' })

    expect(markup).not.toContain(messages.common.retry)
  })

  it('데이터 부재(404)에서는 서버 resultMessage 를 그대로 노출한다', () => {
    const markup = render({ errorStatus: 404, errorMessage: '제주 지역 데이터가 아직 없습니다.' })

    expect(markup).toContain('제주 지역 데이터가 아직 없습니다.')
  })

  it('resultMessage 가 문자열이 아니면 기본 문구로 대체한다', () => {
    const markup = render({ errorStatus: 404, errorMessage: { areaCode: '형식 오류' } })

    expect(markup).toContain(messages.place.emptyTitle)
    expect(markup).not.toContain('[object Object]')
  })

  it('일시 장애(5xx)에서는 재시도 버튼을 노출한다', () => {
    const markup = render({ errorStatus: 503 })

    expect(markup).toContain(messages.common.retry)
    expect(markup).toContain(messages.place.errorTitle)
  })

  it('무응답(status 0)도 일시 장애로 처리해 재시도를 제공한다', () => {
    expect(render({ errorStatus: 0 })).toContain(messages.common.retry)
  })

  it('입력 오류(400)에서는 재시도 대신 필터 초기화를 제안한다', () => {
    const markup = render({ errorStatus: 400 })

    expect(markup).toContain(messages.place.resetFilters)
    expect(markup).not.toContain(messages.common.retry)
  })

  it('담는 곳이 빈 결과 설명을 바꿀 수 있다 — 거리순은 좌표 없는 곳이 빠진다 (#1217)', () => {
    const markup = render({ places: [], emptyDescription: '다른 설명' })

    expect(markup).toContain('다른 설명')
    expect(markup).not.toContain(messages.place.emptyDescription)
    expect(markup).toContain(messages.place.resetFilters)
  })
})

describe('PlaceListSection — 빈 결과', () => {
  it('결과가 0건이면 다음 행동을 안내하고 재시도 버튼은 두지 않는다', () => {
    const markup = render({ places: [] })

    expect(markup).toContain(messages.place.emptyTitle)
    expect(markup).toContain(messages.place.emptyDescription)
    expect(markup).toContain(messages.place.resetFilters)
    expect(markup).not.toContain(messages.common.retry)
  })
})

/**
 * 커서 페이지네이션을 **버튼으로 드러내지 않는다.** "더 보기" 는 사용자가 스크롤로 이미
 * 말한 뜻을 한 번 더 누르게 하는 단계였다 — 감지 표식이 그 자리를 대신한다.
 */
describe('PlaceListSection — 무한 스크롤', () => {
  it('다음 페이지가 있으면 감지 표식을 두고 버튼은 두지 않는다', () => {
    const markup = render({ places: [placeSummary], hasNext: true })

    expect(markup).toContain('class="h-px w-full"')
    // 문구 상수가 아니라 **글자**로 잡는다 — 어느 상수를 쓰든 버튼이 돌아오면 걸린다
    expect(markup).not.toContain('더 보기')
    expect(markup).not.toContain(messages.common.listEnd)
  })

  it('마지막 페이지에서는 감지 표식 없이 종료 문구만 노출한다', () => {
    const markup = render({ places: [placeSummary], hasNext: false })

    expect(markup).toContain(messages.common.listEnd)
    expect(markup).not.toContain('class="h-px w-full"')
  })

  it('추가 로딩 중에는 스켈레톤 행과 진행 안내를 함께 둔다', () => {
    const markup = render({ places: [placeSummary], hasNext: true, loadingMore: true })

    // 목록 끝이 비어 보이지 않아야 한다 — 다음에 무엇이 올지 형태로 예고한다
    expect(markup).toContain('animate-pulse')
    // 스켈레톤은 보조기기에 아무 말도 하지 않는다
    expect(markup).toContain('role="status"')
    expect(markup).toContain(messages.common.loading)
    // 첫 행은 그대로 남는다 — 추가 로딩이 목록을 대체하지 않는다
    expect(markup).toContain(placeSummary.title)
  })

  it('로딩이 끝나면 스켈레톤을 걷는다', () => {
    const markup = render({ places: [placeSummary], hasNext: true, loadingMore: false })

    expect(markup).not.toContain('animate-pulse')
  })
})

describe('PlaceListSection — 첫 화면 사진 우선 로드 (#1132)', () => {
  /** 사진이 있는 행 n개. placeId 는 key 라 서로 달라야 한다 */
  function placesWithPhotos(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      ...placeSummary,
      placeId: `21248171238192${String(index).padStart(4, '0')}`,
      firstImage2: `http://tong.visitkorea.or.kr/cms/resource/60/${String(index)}_image3_1.jpg`,
    }))
  }

  function imgTags(markup: string) {
    return markup.match(/<img[^>]*>/g) ?? []
  }

  it(`앞 ${String(PLACE_PRIORITY_ROW_COUNT)}행만 바로 받고 나머지는 지연 로드다`, () => {
    const tags = imgTags(render({ places: placesWithPhotos(PLACE_PRIORITY_ROW_COUNT + 3) }))

    expect(tags).toHaveLength(PLACE_PRIORITY_ROW_COUNT + 3)
    tags.slice(0, PLACE_PRIORITY_ROW_COUNT).forEach((tag) => {
      expect(tag).toContain('loading="eager"')
      expect(tag).toMatch(/fetchpriority="high"/i)
    })
    tags.slice(PLACE_PRIORITY_ROW_COUNT).forEach((tag) => {
      expect(tag).toContain('loading="lazy"')
      expect(tag).not.toMatch(/fetchpriority/i)
    })
  })

  /*
    **첫 화면이 몇 행인지는 기본 행이 정한다** — `renderRow` 를 갈아끼운 담기 화면은 자기
    행의 로드 방식도 자기가 정한다. 그쪽이 index 를 받아 쓸 수 있게 넘기기는 한다.
  */
  it('renderRow 에 index 를 넘긴다', () => {
    const seen: number[] = []
    render({
      places: placesWithPhotos(3),
      renderRow: (place, index) => {
        seen.push(index)
        return createElement('li', { key: place.placeId }, place.title)
      },
    })

    expect(seen).toEqual([0, 1, 2])
  })
})
