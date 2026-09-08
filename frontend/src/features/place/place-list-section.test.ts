import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { describe, expect, it } from 'vitest'

import { PlaceListSection, type PlaceListSectionProps } from '@/features/place/place-list-section'
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
